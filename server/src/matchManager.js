const logger = require('./logger');

const DAMAGE = {
  PUNCH_L:  parseInt(process.env.DMG_PUNCH_L)  || 8,
  PUNCH_R:  parseInt(process.env.DMG_PUNCH_R)  || 10,
  KICK:     parseInt(process.env.DMG_KICK)      || 15,
  SPECIAL:  parseInt(process.env.DMG_SPECIAL)   || 25,
};

const ATTACK_CMDS = new Set(['PUNCH_L', 'PUNCH_R', 'KICK', 'SPECIAL']);
const MATCH_DURATION = parseInt(process.env.MATCH_DURATION) || 180;
const INITIAL_HP = parseInt(process.env.INITIAL_HP) || 100;

class MatchManager {
  constructor(onStateChange) {
    this.onStateChange = onStateChange; // callback to broadcast state
    this.reset();
  }

  reset() {
    this.active   = false;
    this.hp       = { 1: INITIAL_HP, 2: INITIAL_HP };
    this.timeLeft = MATCH_DURATION;
    this.winner   = null;
    clearInterval(this._interval);
    this._interval = null;
  }

  start() {
    if (this.active) return { ok: false, reason: 'Match already active' };
    this.reset();
    this.active = true;
    logger.ok('Match started');

    this._interval = setInterval(() => {
      this.timeLeft--;
      this._broadcastHP();
      if (this.timeLeft <= 0) this._endMatch('TIME');
    }, 1000);

    return { ok: true };
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    clearInterval(this._interval);
    logger.warn('Match stopped manually');
    this._broadcastHP();
  }

  // Apply damage: attacker hits defender
  applyAttack(attackerPlayer, cmd) {
    if (!this.active) return;
    if (!ATTACK_CMDS.has(cmd)) return;

    const defender = attackerPlayer === 1 ? 2 : 1;
    const dmg = DAMAGE[cmd] || 5;

    this.hp[defender] = Math.max(0, this.hp[defender] - dmg);
    logger.cmd(attackerPlayer, `${cmd} → -${dmg}HP to Robot${defender} (now ${this.hp[defender]}HP)`);

    this._broadcastHP();

    if (this.hp[defender] === 0) {
      this._endMatch(attackerPlayer);
    }
  }

  _endMatch(winner) {
    this.active = false;
    clearInterval(this._interval);
    this.winner = winner;
    logger.ok(`Match ended. Winner: ${winner === 'TIME' ? 'TIME (highest HP)' : `Robot ${winner}`}`);

    const finalWinner = winner === 'TIME'
      ? (this.hp[1] >= this.hp[2] ? 1 : 2)
      : winner;

    this.onStateChange({
      type:    'MATCH_END',
      winner:  finalWinner,
      hp1:     this.hp[1],
      hp2:     this.hp[2],
      reason:  winner === 'TIME' ? 'TIME' : 'KO',
    });
  }

  _broadcastHP() {
    this.onStateChange({
      type:     'HP_UPDATE',
      hp1:      this.hp[1],
      hp2:      this.hp[2],
      timeLeft: this.timeLeft,
    });
  }

  getStatus() {
    return {
      active:   this.active,
      hp:       this.hp,
      timeLeft: this.timeLeft,
      winner:   this.winner,
    };
  }
}

module.exports = MatchManager;
