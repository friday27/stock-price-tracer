const {Pool} = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: true
});

// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
});

async function query(queryString) {
  const client = await pool.connect();
  try {
    const res = await client.query(queryString)
    console.log(res.rows[0])
    return res;
  } catch (err) {
    console.error(err);
  } finally {
    // Make sure to release the client before any error handling,
    // just in case the error handling itself throws an error.
    client.release();
  }
};

async function getUsers() {
  try {
    // skip block, review modes
    const userIds = await query(`SELECT user_id FROM status WHERE mode = 'normal';`);
    return userIds.rows;
  } catch (e) {
    console.log(e);
    return [];
  }
}

const updateUserStatus = function(userId, status, event) {
  try {
    query(`INSERT INTO status (user_id, mode, pointer)
           VALUES ('${userId}', '${status}', 1)
           ON CONFLICT (user_id)
           DO UPDATE SET mode = '${status}', pointer = 1, updated_at = NOW();`);
  } catch (e) {
    replyErrorMsg(e, event);
  }
};

const addWord = async function (userId, word, annotation, event) {
  const dailyLimit = 30;
  try {
    // Check if daily created words > dailyLimit
    let num = await query(`SELECT count(1)
                           FROM voc
                           WHERE user_id = '${userId}'
                           AND created_at > now() - interval '1 day';`);
    num = parseInt(num.rows[0].count);
    if (num >= dailyLimit) {
      return event.reply(`You can only add ${dailyLimit} new words every 24 hours.`);
    } else {
      await query(`INSERT INTO voc (user_id, word, annotation)
                   VALUES ('${userId}', '${word}', '${annotation}')
                   ON CONFLICT (user_id, word)
                   DO UPDATE SET annotation = '${annotation}', updated_at = NOW();`);
      event.reply(`${word} (${annotation}) is saved.`);
      query(`UPDATE status SET total = total + 1 WHERE user_id = '${userId}';`);
    }
  } catch (e) {
    replyErrorMsg(e, event);
  }
};

const updateWord = async function(userId, word, annotation, event) {
  try {
    // Check if the word is in user's list
    const count = await query(`SELECT word
                               FROM voc
                               WHERE user_id = '${userId}'
                               AND word = '${word}';`);
    if (count.rows.length === 0) {
      return event.reply(`${word} is not in your word list.`);
    }

    await query(`UPDATE voc
                 SET annotation = '${annotation}',
                     updated_at = NOW()
                 WHERE word = '${word}'
                 AND user_id = '${userId}';`);
    event.reply(`The definition of ${word} is updated to ${annotation}.`);
  } catch (e) {
    replyErrorMsg(e, event);
  }
};

const showWords = async function (userId, event) {
  try {
    const res = await query(`SELECT word, annotation
                             FROM voc
                             WHERE user_id = '${userId}'
                             ORDER BY level ASC, updated_at ASC;`);
    if (res.rows.length === 0) {
      event.reply('There isn\'t any word in your list.');
    } else {
      let msg = '';
      for (let i in res.rows) {
        msg += `${res.rows[i].word}\n${res.rows[i].annotation}\n--\n`;
      }
      event.reply(msg);
    }
  } catch (e) {
    replyErrorMsg(e, event);
  }
};

const deleteWord = async function (userId, word, event) {
  try {
    await query(`DELETE FROM voc
                 WHERE user_id = '${userId}'
                 AND word = '${word}';`);
    event.reply(`${word} is removed from your list.`);
    query(`UPDATE status SET total = total - 1 WHERE user_id = '${userId}';`);
  } catch (e) {
    replyErrorMsg(e, event);
  }
};

const isReviewMode = async function (userId, userMsg, event, callback) {
  try {
    const res = await query(`SELECT mode FROM status WHERE user_id = '${userId}';`);
    const mode = res.rows[0].mode.trim();
    if (mode === 'review') {
      if (userMsg === '#end') {
        endReviewMode(userId, null, event);
      } else {
        checkAnswer(userId, userMsg, event);
      }
      callback(true);
    } else {
      callback(false);
    }
  } catch (e) {
    replyErrorMsg(e, event);
  }
};

const startReviewMode = async function (userId, event) {
  try {
    // Check there's at least 1 word in user's list
    const count = await query(`SELECT * FROM voc WHERE user_id = '${userId}'`);
    if (count.rows.length === 0) {
      return event.reply('There isn\'t any word saved in your list.');
    }

    // Save user's top 25 words into a temp table
    await query(`CREATE TABLE review_${userId} AS
                 SELECT voc.word, voc.annotation, voc.level
                 FROM voc
                 WHERE user_id = '${userId}'
                 ORDER BY level ASC, updated_at ASC
                 LIMIT 25;`);

    // add id, correct column
    await query(`ALTER TABLE review_${userId}
                 ADD COLUMN correct INT DEFAULT 0,
                 ADD COLUMN id serial;`);

    query(`INSERT INTO status (user_id, mode, pointer)
           VALUES ('${userId}', 'review', 1)
           ON CONFLICT (user_id)
           DO UPDATE SET mode = 'review', pointer = 1;`);

    // Print the first word
    const res = await query(`SELECT * FROM review_${userId} ORDER BY id LIMIT 1`);
    event.reply('Turn on review mode \uDBC0\uDC8D\nPlease enter the definition of this word:\n'+res.rows[0].word);
  } catch (e) {
    replyErrorMsg(e, event);
  }
};

const checkAnswer = async function(userId, userMsg, event) {
  try {
    // get pointer from table status
    const res = await query(`SELECT pointer, total FROM status WHERE user_id = '${userId}';`);
    const total = parseInt(res.rows[0].total);
    const pointer = parseInt(res.rows[0].pointer);

    // get the correct annotation and save result
    let answer = await query(`SELECT * FROM review_${userId} WHERE id = ${pointer};`);
    answer = answer.rows[0];

    let replyMsg = '';
    if (userMsg.toLowerCase().trim() === answer.annotation) {
      await query(`UPDATE review_${userId}
                   SET level = ${answer.level+1}, correct = 1
                   WHERE word = '${answer.word}';`);
      // event.reply(`Correct! \uDBC0\uDC79\nNext word: ${nextWord}`);
      replyMsg += 'Correct! \uDBC0\uDC79';
    } else {
      await query(`UPDATE review_${userId}
                   SET level = ${answer.level-1}
                   WHERE word = '${answer.word}';`);
      // event.reply(`Wrong.. \uDBC0\uDC7D\nIt should be "${answer.annotation}"\nNext word: ${nextWord}`);
      replyMsg += `Wrong.. \uDBC0\uDC7D\nIt should be "${answer.annotation}"`;
    }

    // If 25/all words are reviewed, leave review mode
    if (pointer >= 25 || pointer >= total) {
      endReviewMode(userId, replyMsg, event);
    } else {
      query(`UPDATE status
             SET pointer = ${pointer+1}
             WHERE user_id = '${userId}';`);
      const res = await query(`SELECT word FROM review_${userId} WHERE id = ${pointer+1};`);
      nextWord = res.rows[0].word;
      event.reply(replyMsg+`\nNext word: ${nextWord}`);
    }
  } catch (e) {
    replyErrorMsg(e, event);
  }
};

const endReviewMode = async function(userId, replyMsg, event) {
  try {
    let pointer = await query(`SELECT pointer FROM status WHERE user_id = '${userId}';`);
    pointer = parseInt(pointer.rows[0].pointer);
    const res = await query(`SELECT sum(correct), count(correct) FROM review_${userId};`);
    const score = Math.round(parseInt(res.rows[0].sum) / pointer * 100);
    let scoreMsg = `Turn off review mode.\nYou got ${score} % right this time! `;
    if (replyMsg !== null) {
      scoreMsg = `${replyMsg}\n` + scoreMsg;
    }

    switch (true) {
      case (score == 0):
        scoreMsg += '\uDBC0\uDC7C';
        break;
      case (score < 60):
        scoreMsg += '\uDBC0\uDC8E';
        break;
      case (score < 80):
        scoreMsg += '\uDBC0\uDC90';
        break;
      case (score < 100):
        scoreMsg += '\uDBC0\uDC8A';
        break;
      case (score === 100):
        scoreMsg += '\uDBC0\uDC81';
        break;
      default:
        break;
    }
    event.reply(scoreMsg);

    // save changed levels to voc table
    await query(`UPDATE voc voc
                 SET level = review.level, updated_at = now()
                 FROM review_${userId} review
                 WHERE voc.word = review.word
                 AND review.id <= ${pointer}
                 AND voc.user_id = '${userId}';`);

    // set mode to 'normal' and pointer to 1 (status table)
    query(`UPDATE status
           SET mode = 'normal', pointer = 1
           WHERE user_id = '${userId}';`);

    query(`DROP TABLE review_${userId};`);
  } catch (e) {
    replyErrorMsg(e, event);
  }
};

module.exports = {
  addWord,
  updateWord,
  showWords,
  deleteWord,
  startReviewMode,
  isReviewMode,
  checkAnswer,
  updateUserStatus,
  getUsers
};
