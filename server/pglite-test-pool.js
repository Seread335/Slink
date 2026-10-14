'use strict';

function createPGlitePool(db) {
  return {
    async query(sql, params) {
      return db.query(sql, params);
    },
    async connect() {
      let activeTransaction = null;
      let transactionPromise = null;
      let finishTransaction = null;
      return {
        async query(sql, params = []) {
          const command = String(sql).trim().toUpperCase();
          if (command === 'BEGIN') {
            let announceReady;
            const ready = new Promise((resolve) => { announceReady = resolve; });
            const finished = new Promise((resolve) => { finishTransaction = resolve; });
            transactionPromise = db.transaction(async (tx) => {
              await tx.query('SET ROLE slink_app');
              activeTransaction = tx;
              announceReady();
              const commit = await finished;
              if (!commit) throw new Error('test transaction rollback');
            });
            transactionPromise.catch(() => {});
            await ready;
            return { rows: [], rowCount: null };
          }
          if (command === 'COMMIT') {
            await activeTransaction.query('RESET ROLE');
            finishTransaction(true);
            await transactionPromise;
            activeTransaction = null;
            transactionPromise = null;
            return { rows: [], rowCount: null };
          }
          if (command === 'ROLLBACK') {
            finishTransaction(false);
            try { await transactionPromise; } catch {}
            activeTransaction = null;
            transactionPromise = null;
            return { rows: [], rowCount: null };
          }
          if (!activeTransaction) throw new Error('PGlite test pool requires an active transaction.');
          return activeTransaction.query(sql, params);
        },
        release() {},
      };
    },
    async end() { await db.close(); },
  };
}

module.exports = { createPGlitePool };
