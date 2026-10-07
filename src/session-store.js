const session = require('express-session');
const { randomBytes } = require('node:crypto');

class DatabaseSessionStore extends session.Store {
  constructor(db) { super(); this.db=db; }
  get(sid,callback) {
    try {
      const row=this.db.prepare('SELECT data FROM sessions WHERE sid=? AND expires_at>?').get(sid,Date.now());
      callback(null,row ? JSON.parse(row.data) : null);
    } catch(error) { callback(error); }
  }
  set(sid,value,callback=()=>{}) {
    try {
      this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
      this.db.prepare('INSERT INTO sessions(sid,data,expires_at) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at').run(sid,JSON.stringify(value),this.expiry(value));
      callback(null);
    } catch(error) { callback(error); }
  }
  expiry(value) { return value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now()+86400000; }
  touch(sid,value,callback=()=>{}) {
    try { this.db.prepare('UPDATE sessions SET expires_at=? WHERE sid=?').run(this.expiry(value),sid); callback(null); }
    catch(error) { callback(error); }
  }
  destroy(sid,callback=()=>{}) {
    try { this.db.prepare('DELETE FROM sessions WHERE sid=?').run(sid); callback(null); }
    catch(error) { callback(error); }
  }
}
function sessionSecret(db) {
  if(process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if(process.env.NODE_ENV==='production') throw new Error('Cần SESSION_SECRET khi chạy production');
  db.prepare("INSERT OR IGNORE INTO app_settings(key,value) VALUES('development_session_secret',?)").run(randomBytes(32).toString('hex'));
  return db.prepare("SELECT value FROM app_settings WHERE key='development_session_secret'").get().value;
}
module.exports={DatabaseSessionStore,SQLiteSessionStore:DatabaseSessionStore,sessionSecret};
