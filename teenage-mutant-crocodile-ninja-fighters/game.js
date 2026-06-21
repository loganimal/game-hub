// ============================================
// TEENAGE MUTANT CROCODILE NINJA FIGHTERS
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const MOVE_SPEED = 3;
const TILE_SIZE = 40;

// Swimming
const WATER_GRAVITY = 0.15;
const SWIM_FORCE = -6;
const WATER_SPEED_MULT = 0.7;

// Power-ups
const POWERUP_SIZE = 20;
const SPEED_BOOST_DURATION = 300;
const DAMAGE_BOOST_DURATION = 300;
const STAR_DURATION = 180;
const ABILITY_COOLDOWN = 480;

// Projectiles
const MAX_PROJECTILES = 50;
const PLAYER_PROJECTILE_SPEED = 6;
const PLAYER_PROJECTILE_DAMAGE = 20;

// Game state
let gameState = 'CHARACTER_SELECT'; // CHARACTER_SELECT, PLAYING, PAUSED, GAME_OVER, VICTORY
let currentLevel = 0;
let selectedCharacter = 0;
let frameCount = 0;
let totalNoodles = 0;
let projectiles = [];
let soundEnabled = true;

// Input handling
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (gameState === 'PLAYING' && player) {
        if (e.code === 'Space') { e.preventDefault(); player.attack(); }
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { e.preventDefault(); player.useAbility(); }
        if (e.code === 'KeyZ') player.shoot();
        if (e.code === 'KeyG') { e.preventDefault(); player.godMode = !player.godMode; }
    }
});
document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// ============================================
// CHARACTERS
// ============================================
const CHARACTERS = [
    { name: 'Rex', color: '#FF4444', weapon: 'staff', bandana: '#FF0000' },
    { name: 'Splash', color: '#4444FF', weapon: 'swords', bandana: '#0000FF' },
    { name: 'Techno', color: '#AA44AA', weapon: 'nunchucks', bandana: '#800080' },
    { name: 'Tanger', color: '#FFAA44', weapon: 'sais', bandana: '#FF8800' }
];

// ============================================
// SOUND FX (Web Audio API)
// ============================================
const SoundFX = {
    _ctx: null,
    _getCtx() {
        if (!this._ctx) {
            try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
        }
        return this._ctx;
    },
    _playTone(freq, duration, type = 'square', volume = 0.1) {
        const ctx = this._getCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    },
    _playSweep(startFreq, endFreq, duration, type = 'square', volume = 0.1) {
        const ctx = this._getCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    },
    jump() { this._playSweep(200, 400, 0.1, 'square', 0.08); },
    attack() { this._playTone(150, 0.05, 'sawtooth', 0.06); },
    hurt() { this._playTone(100, 0.12, 'sawtooth', 0.1); },
    collect() { this._playSweep(500, 800, 0.1, 'square', 0.08); },
    enemyDeath() { this._playSweep(400, 100, 0.2, 'sawtooth', 0.08); },
    powerup() { this._playSweep(300, 900, 0.15, 'square', 0.1); },
    ability() { this._playSweep(200, 600, 0.2, 'sawtooth', 0.08); },
    victory() {
        this._playSweep(400, 600, 0.15, 'square', 0.1);
        setTimeout(() => this._playSweep(500, 700, 0.15, 'square', 0.1), 150);
        setTimeout(() => this._playSweep(600, 900, 0.3, 'square', 0.1), 300);
    },
    splash() { this._playTone(300, 0.08, 'sine', 0.05); }
};

// ============================================
// PLAYER CLASS
// ============================================
class Player {
    constructor(x, y, characterIndex) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 48;
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        this.facingRight = true;
        this.character = CHARACTERS[characterIndex];
        
        this.maxHealth = 100;
        this.health = 100;
        this.noodles = 0;
        this.lives = 10;
        
        this.attacking = false;
        this.attackTimer = 0;
        this.invincible = false;
        this.invincibleTimer = 0;
        
        this.animFrame = 0;
        
        this.inWater = false;
        this.wasInWater = false;
        this.speedBoostTimer = 0;
        this.damageBoostTimer = 0;
        this.hasShuriken = false;
        this.shurikenCooldown = 0;
        this.abilityCooldown = 0;
        this.abilityReady = true;
        this.doubleJumped = false;
        this.canDoubleJump = false;
        this.platformVx = 0;
        this.godMode = false;
    }
    
    isInWater() {
        if (!currentLevelData.water) return false;
        for (let w of currentLevelData.water) {
            if (this.x + this.width > w.x && this.x < w.x + w.width &&
                this.y + this.height > w.y && this.y < w.y + w.height) {
                return true;
            }
        }
        return false;
    }
    
    update() {
        this.animFrame++;
        this.wasInWater = this.inWater;
        this.inWater = this.isInWater();
        
        if (this.inWater && !this.wasInWater) SoundFX.splash();
        
        let speed = MOVE_SPEED;
        if (this.speedBoostTimer > 0) speed *= 1.5;
        if (this.inWater) speed *= WATER_SPEED_MULT;
        
        if (keys['ArrowLeft']) {
            this.vx = -speed;
            this.facingRight = false;
        } else if (keys['ArrowRight']) {
            this.vx = speed;
            this.facingRight = true;
        } else {
            this.vx *= 0.8;
        }
        
        if (this.grounded) {
            this.vx += this.platformVx;
            this.platformVx = 0;
        }
        
        if (keys['ArrowUp']) {
            if (this.inWater) {
                // Near surface → full jump out; deep → gentle swim
                let nearSurface = false;
                if (currentLevelData.water) {
                    for (let w of currentLevelData.water) {
                        if (this.y + this.height > w.y && this.y + this.height < w.y + 25) nearSurface = true;
                    }
                }
                this.vy = nearSurface ? JUMP_FORCE : SWIM_FORCE;
                this.grounded = false;
                if (nearSurface) SoundFX.splash();
            } else if (this.grounded) {
                this.vy = JUMP_FORCE;
                this.grounded = false;
                SoundFX.jump();
            } else if (this.canDoubleJump && !this.doubleJumped) {
                this.vy = JUMP_FORCE * 0.85;
                this.doubleJumped = true;
                SoundFX.jump();
            }
        }
        
        if (this.inWater) {
            this.vy += WATER_GRAVITY;
            if (this.vy > 3) this.vy = 3;
        } else {
            this.vy += GRAVITY;
        }
        
        this.x += this.vx;
        this.y += this.vy;
        
        // Platform collisions
        this.grounded = false;
        for (let platform of currentLevelData.platforms) {
            if (this.checkCollision(platform)) {
                if (this.vy > 0 && this.y < platform.y) {
                    this.y = platform.y - this.height;
                    this.vy = 0;
                    this.grounded = true;
                    this.doubleJumped = false;
                    if (platform.vx) this.platformVx = platform.vx;
                } else if (this.vy < 0 && this.y > platform.y) {
                    this.y = platform.y + platform.height;
                    this.vy = 0;
                } else if (this.vx > 0) {
                    this.x = platform.x - this.width;
                    this.vx = 0;
                } else if (this.vx < 0) {
                    this.x = platform.x + platform.width;
                    this.vx = 0;
                }
            }
        }
        
        // Screen bounds
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - this.width) this.x = canvas.width - this.width;
        
        // Water surface clamp
        if (this.inWater && currentLevelData.water) {
            for (let w of currentLevelData.water) {
                if (this.y < w.y - 10) { this.y = w.y - 10; this.vy = 0; }
            }
        }
        
        if (this.y > canvas.height) {
            this.takeDamage(25);
            this.respawn();
        }
        
        // Timers
        if (this.attacking) {
            this.attackTimer--;
            if (this.attackTimer <= 0) this.attacking = false;
        }
        if (this.invincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) this.invincible = false;
        }
        if (this.speedBoostTimer > 0) this.speedBoostTimer--;
        if (this.damageBoostTimer > 0) this.damageBoostTimer--;
        if (this.shurikenCooldown > 0) this.shurikenCooldown--;
        if (this.abilityCooldown > 0) {
            this.abilityCooldown--;
            if (this.abilityCooldown <= 0) this.abilityReady = true;
        }
        
        // Noodle collection
        for (let i = currentLevelData.noodles.length - 1; i >= 0; i--) {
            let noodle = currentLevelData.noodles[i];
            if (this.checkCollision(noodle)) {
                this.noodles++;
                currentLevelData.noodles.splice(i, 1);
                SoundFX.collect();
                if (this.noodles % 10 === 0) this.lives++;
            }
        }
        
        // Power-up collection
        if (currentLevelData.powerups) {
            for (let i = currentLevelData.powerups.length - 1; i >= 0; i--) {
                let pu = currentLevelData.powerups[i];
                if (this.x < pu.x + POWERUP_SIZE && this.x + this.width > pu.x &&
                    this.y < pu.y + POWERUP_SIZE && this.y + this.height > pu.y) {
                    this.applyPowerup(pu.type);
                    currentLevelData.powerups.splice(i, 1);
                    SoundFX.powerup();
                }
            }
        }
        
        // Hazard collision
        if (currentLevelData.hazards) {
            for (let hazard of currentLevelData.hazards) {
                if (this.checkCollision(hazard)) this.takeDamage(30);
            }
        }
        
        // Level exit
        if (currentLevelData.exit && this.checkCollision(currentLevelData.exit)) {
            nextLevel();
        }
    }
    
    applyPowerup(type) {
        switch (type) {
            case 'steak': this.health = Math.min(this.maxHealth, this.health + 30); break;
            case 'speed': this.speedBoostTimer = SPEED_BOOST_DURATION; break;
            case 'damage': this.damageBoostTimer = DAMAGE_BOOST_DURATION; break;
            case 'star': this.invincible = true; this.invincibleTimer = STAR_DURATION; break;
            case 'shuriken': this.hasShuriken = true; break;
        }
    }
    
    useAbility() {
        if (!this.abilityReady) return;
        this.abilityReady = false;
        this.abilityCooldown = ABILITY_COOLDOWN;
        SoundFX.ability();
        switch (this.character.weapon) {
            case 'staff':
                if (this.grounded) {
                    for (let e of currentLevelData.enemies) {
                        if (!e.dead && Math.abs(e.x - this.x) < 150) e.takeDamage(30);
                    }
                }
                break;
            case 'swords':
                this.canDoubleJump = true;
                this.doubleJumped = false;
                if (!this.grounded) { this.vy = JUMP_FORCE * 0.85; this.doubleJumped = true; }
                break;
            case 'nunchucks':
                this.x += (this.facingRight ? 1 : -1) * 120;
                if (this.x < 0) this.x = 0;
                if (this.x > canvas.width - this.width) this.x = canvas.width - this.width;
                break;
            case 'sais':
                for (let e of currentLevelData.enemies) {
                    if (!e.dead && Math.abs(e.x - this.x) < 100) { e.stunned = true; e.stunTimer = 60; }
                }
                for (let i = projectiles.length - 1; i >= 0; i--) {
                    if (projectiles[i].isEnemy && Math.abs(projectiles[i].x - this.x) < 120) {
                        projectiles[i].vx *= -1; projectiles[i].isEnemy = false;
                    }
                }
                break;
        }
    }
    
    shoot() {
        if (!this.hasShuriken || this.shurikenCooldown > 0) return;
        this.shurikenCooldown = 30;
        let dir = this.facingRight ? 1 : -1;
        if (projectiles.length < MAX_PROJECTILES) {
            projectiles.push(new Projectile(
                this.x + (this.facingRight ? this.width : 0),
                this.y + this.height / 2,
                PLAYER_PROJECTILE_SPEED * dir, 0, false, PLAYER_PROJECTILE_DAMAGE
            ));
        }
    }
    
    checkCollision(rect) {
        return this.x < rect.x + rect.width &&
               this.x + this.width > rect.x &&
               this.y < rect.y + rect.height &&
               this.y + this.height > rect.y;
    }
    
    attack() {
        if (!this.attacking) {
            this.attacking = true;
            this.attackTimer = 15;
            SoundFX.attack();
            let attackRange = {
                x: this.facingRight ? this.x + this.width : this.x - 40,
                y: this.y, width: 40, height: this.height
            };
            for (let enemy of currentLevelData.enemies) {
                if (!enemy.dead &&
                    attackRange.x < enemy.x + enemy.width &&
                    attackRange.x + attackRange.width > enemy.x &&
                    attackRange.y < enemy.y + enemy.height &&
                    attackRange.y + attackRange.height > enemy.y) {
                    let dmg = 34;
                    if (this.damageBoostTimer > 0) dmg *= 2;
                    enemy.takeDamage(dmg);
                }
            }
        }
    }
    
    takeDamage(amount) {
        if (this.invincible || this.godMode) return;
        SoundFX.hurt();
        this.health -= amount;
        this.invincible = true;
        this.invincibleTimer = 60;
        if (this.health <= 0) {
            this.lives--;
            if (this.lives > 0) { this.health = this.maxHealth; this.respawn(); }
            else { gameState = 'GAME_OVER'; }
        }
    }
    
    respawn() {
        this.x = currentLevelData.startX;
        this.y = currentLevelData.startY;
        this.vx = 0;
        this.vy = 0;
        this.inWater = false;
    }
    
    draw() {
        if (this.invincible && Math.floor(this.animFrame / 4) % 2 === 0) return;
        ctx.save();
        let swimBob = this.inWater ? Math.sin(this.animFrame * 0.08) * 3 : 0;
        let dy = this.y + swimBob;
        let tailWag = (Math.abs(this.vx) > 0.1 || this.inWater) ? Math.sin(this.animFrame * 0.4) * 8 : 0;
        
        ctx.fillStyle = '#1a6b1a';
        ctx.beginPath();
        ctx.moveTo(this.x + 4, dy + 28);
        ctx.lineTo(this.x - 12, dy + 24 + tailWag);
        ctx.lineTo(this.x - 8, dy + 32 + tailWag);
        ctx.lineTo(this.x + 4, dy + 36);
        ctx.fill();
        
        ctx.fillStyle = '#228B22';
        ctx.fillRect(this.x + 2, dy + 14, 28, 26);
        ctx.fillStyle = '#1a6b1a';
        ctx.fillRect(this.x + 6, dy + 16, 4, 4); ctx.fillRect(this.x + 14, dy + 18, 4, 4);
        ctx.fillRect(this.x + 22, dy + 16, 4, 4); ctx.fillRect(this.x + 10, dy + 26, 4, 4);
        ctx.fillRect(this.x + 18, dy + 28, 4, 4);
        ctx.fillStyle = '#90EE90';
        ctx.fillRect(this.x + 8, dy + 30, 16, 8);
        
        ctx.fillStyle = '#228B22';
        ctx.fillRect(this.x + (this.facingRight ? 12 : -4), dy + 2, 24, 16);
        ctx.fillRect(this.x + (this.facingRight ? 28 : -12), dy + 6, 14, 10);
        ctx.fillStyle = '#FFF';
        ctx.fillRect(this.x + (this.facingRight ? 20 : 4), dy, 6, 6);
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x + (this.facingRight ? 22 : 6), dy + 2, 3, 3);
        ctx.fillStyle = '#1a6b1a';
        ctx.fillRect(this.x + (this.facingRight ? 18 : 2), dy - 2, 10, 3);
        ctx.fillStyle = '#FFF';
        for (let i = 0; i < 3; i++) {
            let tx = this.x + (this.facingRight ? 32 + i * 4 : -6 - i * 4);
            ctx.fillRect(tx, dy + 14, 2, 4);
        }
        ctx.fillStyle = '#0F0';
        ctx.fillRect(this.x + (this.facingRight ? 38 : -8), dy + 8, 2, 2);
        
        ctx.fillStyle = this.character.bandana;
        ctx.fillRect(this.x - 2, dy + 12, 36, 8);
        let tw = Math.sin(this.animFrame * 0.3) * 3;
        ctx.fillRect(this.x + (this.facingRight ? -10 : 26), dy + 14 + tw, 10, 5);
        ctx.fillRect(this.x + (this.facingRight ? -8 : 28), dy + 18 - tw, 8, 4);
        
        if (this.attacking) {
            let ap = 1 - (this.attackTimer / 15);
            if (this.character.weapon === 'staff') {
                ctx.fillStyle = '#8B4513'; ctx.save();
                ctx.translate(this.x + (this.facingRight ? 24 : 8), dy + 20);
                ctx.rotate((this.facingRight ? 1 : -1) * (-Math.PI/3 + ap * Math.PI*1.5));
                ctx.fillRect(-2, -24, 4, 48);
                ctx.fillStyle = '#FFD700'; ctx.fillRect(-3, -28, 6, 6); ctx.restore();
            } else if (this.character.weapon === 'swords') {
                ctx.fillStyle = '#C0C0C0'; ctx.save();
                ctx.translate(this.x + (this.facingRight ? 24 : 8), dy + 18);
                ctx.rotate((this.facingRight ? 1 : -1) * (ap * Math.PI));
                ctx.fillRect(0, -20, 4, 28); ctx.fillStyle = '#8B0000'; ctx.fillRect(-2, 4, 8, 4);
                ctx.fillStyle = '#C0C0C0'; ctx.fillRect(10, -20, 4, 28);
                ctx.fillStyle = '#8B0000'; ctx.fillRect(8, 4, 8, 4); ctx.restore();
            } else if (this.character.weapon === 'nunchucks') {
                ctx.fillStyle = '#8B4513'; let sa = ap * Math.PI * 4;
                let sx = this.x + (this.facingRight ? 32 : 0), sy = dy + 20;
                for (let i = 0; i < 4; i++) { let ca = sa + i * 0.5;
                    ctx.fillStyle = '#444'; ctx.fillRect(sx+Math.cos(ca)*(8+i*6)-2, sy+Math.sin(ca)*15-2, 4, 4); }
                ctx.fillStyle = '#8B4513'; ctx.fillRect(sx - 4, sy - 3, 8, 6);
                ctx.fillStyle = '#FFD700'; ctx.fillRect(sx - 6, sy - 4, 4, 8);
                ctx.fillStyle = '#8B4513'; ctx.save();
                ctx.translate(sx + Math.cos(sa)*30, sy + Math.sin(sa)*20); ctx.rotate(sa);
                ctx.fillRect(-4, -3, 10, 6); ctx.restore();
            } else if (this.character.weapon === 'sais') {
                ctx.fillStyle = '#C0C0C0'; let so = Math.sin(ap * Math.PI) * 20;
                let sx = this.x + (this.facingRight ? 28 + so : 4 - so);
                ctx.fillRect(sx, dy + 16 - 20, 3, 24);
                ctx.beginPath(); ctx.moveTo(sx - 1, dy + 16 - 15); ctx.lineTo(sx - 6, dy + 16 - 8); ctx.lineTo(sx - 1, dy + 16 - 8); ctx.fill();
                ctx.beginPath(); ctx.moveTo(sx + 4, dy + 16 - 15); ctx.lineTo(sx + 9, dy + 16 - 8); ctx.lineTo(sx + 4, dy + 16 - 8); ctx.fill();
                ctx.fillStyle = '#333'; ctx.fillRect(sx - 1, dy + 16, 5, 8);
                ctx.fillStyle = '#C0C0C0'; ctx.fillRect(sx + 8, dy + 16 - 16, 3, 22);
                ctx.beginPath(); ctx.moveTo(sx + 7, dy + 16 - 12); ctx.lineTo(sx + 2, dy + 16 - 6); ctx.lineTo(sx + 7, dy + 16 - 6); ctx.fill();
                ctx.beginPath(); ctx.moveTo(sx + 12, dy + 16 - 12); ctx.lineTo(sx + 17, dy + 16 - 6); ctx.lineTo(sx + 12, dy + 16 - 6); ctx.fill();
                ctx.fillStyle = '#333'; ctx.fillRect(sx + 7, dy + 16 + 2, 5, 8);
            }
        } else {
            ctx.fillStyle = '#8B4513';
            if (this.character.weapon === 'staff') {
                ctx.fillRect(this.x + 10, dy + 4, 3, 28);
                ctx.fillStyle = '#FFD700'; ctx.fillRect(this.x + 9, dy + 2, 5, 4);
            } else if (this.character.weapon === 'swords') {
                ctx.fillStyle = '#C0C0C0';
                ctx.fillRect(this.x + 8, dy + 6, 2, 18); ctx.fillRect(this.x + 12, dy + 6, 2, 18);
                ctx.fillStyle = '#8B0000'; ctx.fillRect(this.x + 6, dy + 20, 10, 3);
            } else if (this.character.weapon === 'nunchucks') {
                ctx.fillStyle = '#8B4513'; ctx.fillRect(this.x + 22, dy + 8, 4, 8);
                ctx.fillRect(this.x + 26, dy + 10, 3, 6);
            } else if (this.character.weapon === 'sais') {
                ctx.fillStyle = '#C0C0C0'; ctx.fillRect(this.x + 22, dy + 8, 2, 12);
                ctx.fillRect(this.x + 26, dy + 10, 2, 10);
            }
        }
        
        ctx.fillStyle = '#228B22';
        let armOff = Math.sin(this.animFrame * 0.2) * 3;
        ctx.fillRect(this.x + 2, dy + 18 + armOff, 6, 10);
        ctx.fillRect(this.x + 24, dy + 18 - armOff, 6, 10);
        
        let legAnim = Math.abs(this.vx) > 0.1 ? Math.sin(this.animFrame * 0.3) * 6 : 0;
        if (this.inWater) legAnim = Math.sin(this.animFrame * 0.15) * 4;
        ctx.fillStyle = '#228B22';
        ctx.fillRect(this.x + 4, dy + 36 + legAnim, 10, 10 - legAnim);
        ctx.fillRect(this.x + 18, dy + 36 - legAnim, 10, 10 + legAnim);
        ctx.fillStyle = '#444';
        ctx.fillRect(this.x + 4, dy + 44, 2, 4); ctx.fillRect(this.x + 8, dy + 44, 2, 4);
        ctx.fillRect(this.x + 20, dy + 44, 2, 4); ctx.fillRect(this.x + 24, dy + 44, 2, 4);
        
        if (this.damageBoostTimer > 0 || this.speedBoostTimer > 0 || this.invincible) {
            ctx.fillStyle = this.invincible ? 'rgba(255,255,0,0.15)' :
                this.damageBoostTimer > 0 ? 'rgba(255,0,0,0.15)' : 'rgba(0,255,255,0.15)';
            ctx.fillRect(this.x - 4, this.y - 4, this.width + 8, this.height + 8);
        }
        ctx.restore();
    }
}

// ============================================
// PROJECTILE CLASS
// ============================================
class Projectile {
    constructor(x, y, vx, vy, isEnemy = false, damage = 15) {
        this.x = x;
        this.y = y;
        this.width = 8;
        this.height = 8;
        this.vx = vx;
        this.vy = vy;
        this.isEnemy = isEnemy;
        this.damage = damage;
        this.dead = false;
        this.animFrame = 0;
    }
    
    update() {
        if (this.dead) return;
        this.animFrame++;
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1;
        
        // Remove if off screen
        if (this.x < -50 || this.x > canvas.width + 50 || this.y < -50 || this.y > canvas.height + 50) {
            this.dead = true;
            return;
        }
        
        // Platform collision
        for (let platform of currentLevelData.platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y < platform.y + platform.height &&
                this.y + this.height > platform.y) {
                this.dead = true;
                return;
            }
        }
        
        // Hit player (enemy projectiles)
        if (this.isEnemy && player && player.checkCollision(this)) {
            player.takeDamage(this.damage);
            this.dead = true;
            return;
        }
        
        // Hit enemies (player projectiles)
        if (!this.isEnemy) {
            for (let enemy of currentLevelData.enemies) {
                if (!enemy.dead && !enemy.stunned &&
                    this.x < enemy.x + enemy.width &&
                    this.x + this.width > enemy.x &&
                    this.y < enemy.y + enemy.height &&
                    this.y + this.height > enemy.y) {
                    enemy.takeDamage(this.damage);
                    this.dead = true;
                    return;
                }
            }
        }
    }
    
    draw() {
        if (this.dead) return;
        ctx.save();
        if (this.isEnemy) {
            ctx.fillStyle = '#7B00FF';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#AA44FF';
            ctx.fillRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);
        } else {
            let spin = Math.sin(this.animFrame * 0.3) * 4;
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(this.x + spin, this.y, 4, this.height);
            ctx.fillRect(this.x + 2, this.y - 2, 4, this.height + 4);
            ctx.fillStyle = '#FFA500';
            ctx.fillRect(this.x + spin + 1, this.y + 1, 2, this.height - 2);
        }
        ctx.restore();
    }
}

// ============================================
// ENEMY CLASS
// ============================================
class Enemy {
    constructor(x, y, type = 'basic') {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.type = type;
        this.vx = 0;
        this.vy = 0;
        this.patrolDistance = 100;
        this.dead = false;
        this.animFrame = 0;
        this.attackCooldown = 0;
        this.grounded = false;
        this.groundPoundCooldown = 0;
        this.groundPounding = false;
        this._victoryTriggered = false;
        this.stunned = false;
        this.stunTimer = 0;
        this.shootCooldown = 0;
        
        switch (type) {
            case 'basic':
                this.width = 32; this.height = 40;
                this.health = 50; this.vx = 1;
                break;
            case 'zombie':
                this.width = 32; this.height = 44;
                this.health = 70; this.vx = 0;
                this.resurrectionTimer = 0;
                break;
            case 'shooter':
                this.width = 32; this.height = 40;
                this.health = 40; this.vx = 0;
                this.shootCooldown = 60 + Math.random() * 60;
                break;
            case 'boss':
                this.width = 48; this.height = 56;
                this.health = 300; this.vx = 0;
                break;
            case 'finalboss':
                this.width = 56; this.height = 64;
                this.health = 400; this.vx = 0;
                this.charging = false;
                this.chargeCooldown = 0;
                this.chargeTimer = 0;
                break;
        }
        this.maxHealth = this.health;
        
        // Difficulty scaling: later levels get tougher basics
        let levelIdx = currentLevel || 0;
        if (type === 'basic' && levelIdx >= 2) this.health += 10 * Math.min(levelIdx - 1, 4);
        if (type === 'zombie' && levelIdx >= 9) this.health += 20;
        if (type === 'shooter' && levelIdx >= 9) this.shootCooldown = Math.max(30, this.shootCooldown - 20);
        this.maxHealth = this.health;
    }
    
    update() {
        if (this.dead) {
            // Zombie resurrection
            if (this.type === 'zombie' && this.resurrectionTimer > 0) {
                this.resurrectionTimer--;
                if (this.resurrectionTimer <= 0) {
                    // Check if player is nearby - if so, permanently dead
                    let dist = player ? Math.abs(player.x - this.x) : 999;
                    if (dist > 100) {
                        this.dead = false;
                        this.health = Math.floor(this.maxHealth * 0.5);
                        this.vx = 0;
                        this.animFrame = 0;
                    }
                }
            }
            return;
        }
        
        if (this.stunned) {
            this.stunTimer--;
            if (this.stunTimer <= 0) this.stunned = false;
            return;
        }
        
        this.animFrame++;
        
        // Stagger effect for zombies
        if (this.type === 'zombie') {
            let dx = player.x - this.x;
            let speed = 0.8;
            if (Math.abs(dx) > 30) {
                this.vx = dx > 0 ? speed : -speed;
                this.x += Math.sin(this.animFrame * 0.05) * 0.5 + this.vx;
            }
            if (this.checkCollision(player) && !player.invincible) {
                player.takeDamage(12);
            }
        }
        
        // Shooter behavior
        else if (this.type === 'shooter') {
            this.shootCooldown--;
            if (this.shootCooldown <= 0) {
                this.shootCooldown = 90;
                let dx = player.x - this.x;
                let dy = (player.y + 20) - (this.y + 20);
                let dist = Math.sqrt(dx * dx + dy * dy) || 1;
                if (projectiles.length < MAX_PROJECTILES) {
                    projectiles.push(new Projectile(
                        this.x + 16, this.y + 20,
                        (dx / dist) * 3, (dy / dist) * 3,
                        true, 15
                    ));
                }
            }
        }
        
        // Boss and Mutant boss behavior
        else if (this.type === 'boss' || this.type === 'finalboss') {
            if (this.attackCooldown > 0) this.attackCooldown--;
            if (this.groundPoundCooldown > 0) this.groundPoundCooldown--;
            
            let dx = player.x - this.x;
            let isFinal = this.type === 'finalboss';
            let isAngry = this.health < this.maxHealth * 0.5;
            let speed = isFinal ? (isAngry ? 2.5 : 1.8) : 2.0;
            let meleeRange = isFinal ? 70 : 60;
            let meleeDamage = isFinal ? 30 : 25;
            let meleeCooldown = isFinal ? 70 : 60;
            
            // Mutant boss: charge attack
            if (isFinal) {
                if (this.chargeCooldown > 0) this.chargeCooldown--;
                if (this.charging) {
                    this.chargeTimer--;
                    let chargeDir = this.chargeDir || 1;
                    this.x += chargeDir * (isAngry ? 8 : 6);
                    if (this.chargeTimer <= 0) this.charging = false;
                    // Charge hit
                    if (this.checkCollision(player)) {
                        player.takeDamage(isAngry ? 35 : 25);
                        this.charging = false;
                    }
                } else if (this.chargeCooldown === 0 && Math.abs(dx) > 100 && Math.abs(dx) < 300 && this.grounded) {
                    this.charging = true;
                    this.chargeTimer = 30;
                    this.chargeDir = dx > 0 ? 1 : -1;
                    this.chargeCooldown = isAngry ? 120 : 180;
                }
                
                // Mutant boss: poison spit
                if (!this.charging && this.attackCooldown === 0 && Math.abs(dx) > 80 && Math.random() < 0.02) {
                    if (projectiles.length < MAX_PROJECTILES) {
                        projectiles.push(new Projectile(
                            this.x + (dx > 0 ? this.width : 0), this.y + 20,
                            (dx > 0 ? 3 : -3), -1.5, true, 18
                        ));
                        this.attackCooldown = 50;
                    }
                }
            }
            
            // Ground pound
            if (this.groundPoundCooldown === 0 && this.grounded && !this.groundPounding && !this.charging) {
                if (Math.abs(dx) < 200) {
                    this.vy = -10;
                    this.groundPounding = true;
                }
            }
            if (this.groundPounding && this.grounded) {
                this.groundPounding = false;
                this.groundPoundCooldown = isFinal ? (isAngry ? 150 : 200) : 180;
                if (Math.abs(dx) < 120 && Math.abs(player.y - (this.y + this.height)) < 10) {
                    player.takeDamage(isAngry ? 25 : 20);
                }
            }
            
            // Move toward player
            if (!this.charging && Math.abs(dx) > meleeRange && !this.groundPounding) {
                this.vx = dx > 0 ? speed : -speed;
                this.x += this.vx;
            }
            
            // Melee attack
            if (!this.charging && Math.abs(dx) < meleeRange && this.attackCooldown === 0 && !this.groundPounding) {
                if (Math.abs(player.y - this.y) < 50) {
                    player.takeDamage(meleeDamage);
                    this.attackCooldown = meleeCooldown;
                }
            }
        }
        
        // Basic enemy patrol
        else if (this.type === 'basic') {
            this.x += this.vx;
            if (Math.abs(this.x - this.startX) > this.patrolDistance) this.vx *= -1;
            if (this.checkCollision(player) && !player.invincible) {
                player.takeDamage(15);
            }
        }
        
        // Apply gravity
        this.vy += GRAVITY * (this.type === 'boss' || this.type === 'finalboss' ? 1.0 : 0.5);
        this.y += this.vy;
        
        // Ground collision
        this.grounded = false;
        for (let platform of currentLevelData.platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y + this.height > platform.y &&
                this.y + this.height < platform.y + platform.height + 10) {
                this.y = platform.y - this.height;
                this.vy = 0;
                this.grounded = true;
            }
        }
    }
    
    checkCollision(rect) {
        return this.x < rect.x + rect.width &&
               this.x + this.width > rect.x &&
               this.y < rect.y + rect.height &&
               this.y + this.height > rect.y;
    }
    
    takeDamage(amount) {
        if (this.dead) return;
        this.health -= amount;
        this.vx = player.facingRight ? 3 : -3;
        this.vy = -3;
        SoundFX.enemyDeath();
        
        if (this.health <= 0) {
            this.dead = true;
            this.charging = false;
            currentLevelData.noodles.push({ x: this.x + 8, y: this.y, width: 16, height: 16 });
            // Zombie resurrection timer
            if (this.type === 'zombie') {
                this.resurrectionTimer = 180;
            }
        }
    }
    
    draw() {
        if (this.dead) {
            // Draw resurrection glow for zombies
            if (this.type === 'zombie' && this.resurrectionTimer > 0) {
                ctx.save();
                ctx.fillStyle = `rgba(100, 255, 100, ${0.1 + Math.sin(this.resurrectionTimer * 0.1) * 0.1})`;
                ctx.fillRect(this.x - 4, this.y - 4, this.width + 8, this.height + 8);
                ctx.restore();
            }
            return;
        }
        
        ctx.save();
        
        // Stun visual
        if (this.stunned) {
            ctx.globalAlpha = 0.5 + Math.sin(this.animFrame * 0.3) * 0.3;
        }
        
        if (this.type === 'finalboss') {
            // MUTANT BOSS - mutated crocodile abomination
            let angry = this.health < this.maxHealth * 0.5;
            let baseColor = angry ? '#2a0a00' : '#1a3a0a';
            let veinColor = angry ? '#FF00FF' : '#7B00AA';
            let eyeColor = angry ? '#FF00FF' : '#FF0000';
            
            // Body
            ctx.fillStyle = baseColor;
            ctx.fillRect(this.x, this.y, 56, 64);
            
            // Mutated bulges
            ctx.fillStyle = angry ? '#3a1a1a' : '#2a4a1a';
            ctx.fillRect(this.x - 6, this.y + 8, 10, 16);
            ctx.fillRect(this.x + 52, this.y + 12, 10, 16);
            ctx.fillRect(this.x + 10, this.y - 6, 36, 8);
            
            // Glowing veins (phase 2)
            if (angry) {
                for (let i = 0; i < 4; i++) {
                    ctx.fillStyle = `rgba(255, 0, 255, ${0.3 + Math.sin(this.animFrame * 0.1 + i) * 0.2})`;
                    ctx.fillRect(this.x + 8 + i * 12, this.y + 20 + Math.sin(this.animFrame * 0.05 + i) * 4, 4, 20);
                }
            }
            
            // Extra eyes (mutant feature)
            ctx.fillStyle = '#FFF';
            ctx.fillRect(this.x + 4, this.y + 6, 8, 8);
            ctx.fillRect(this.x + 44, this.y + 6, 8, 8);
            if (angry) {
                ctx.fillRect(this.x + 24, this.y + 2, 8, 8);
                ctx.fillRect(this.x + 16, this.y + 16, 6, 6);
                ctx.fillRect(this.x + 34, this.y + 16, 6, 6);
            }
            ctx.fillStyle = eyeColor;
            ctx.fillRect(this.x + 6, this.y + 8, 4, 4);
            ctx.fillRect(this.x + 46, this.y + 8, 4, 4);
            if (angry) {
                ctx.fillRect(this.x + 26, this.y + 4, 4, 4);
                ctx.fillRect(this.x + 18, this.y + 18, 3, 3);
                ctx.fillRect(this.x + 36, this.y + 18, 3, 3);
            }
            
            // Slime trail
            ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            ctx.fillRect(this.x - 4, this.y + 58, 64, 10);
            ctx.fillRect(this.x - 8, this.y + 62, 72, 6);
            
            // Claws
            ctx.fillStyle = '#222';
            ctx.fillRect(this.x - 4, this.y + 44, 6, 12);
            ctx.fillRect(this.x + 54, this.y + 44, 6, 12);
            ctx.fillStyle = '#555';
            ctx.fillRect(this.x - 6, this.y + 52, 4, 6);
            ctx.fillRect(this.x + 58, this.y + 52, 4, 6);
            
        } else if (this.type === 'boss') {
            let angry = this.health < this.maxHealth * 0.5;
            ctx.fillStyle = angry ? '#6a00a0' : '#4a0080';
            ctx.fillRect(this.x, this.y, 48, 56);
            ctx.fillStyle = angry ? '#FF6600' : '#FF0000';
            ctx.fillRect(this.x + 8, this.y + 8, 12, 12);
            ctx.fillRect(this.x + 28, this.y + 8, 12, 12);
            ctx.fillStyle = '#222';
            ctx.fillRect(this.x - 4, this.y - 8, 12, 16);
            ctx.fillRect(this.x + 40, this.y - 8, 12, 16);
            ctx.fillStyle = '#000';
            ctx.fillRect(this.x, this.y - 16, 48, 8);
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(this.x + 2, this.y - 14, (this.health / this.maxHealth) * 44, 4);
            
        } else if (this.type === 'zombie') {
            // ZOMBIE - decaying green corps
            ctx.fillStyle = '#3a5a2a';
            ctx.fillRect(this.x + 2, this.y + 4, 28, 32);
            ctx.fillStyle = '#2a4a1a';
            ctx.fillRect(this.x + 4, this.y + 8, 24, 8);
            
            // Stitches
            ctx.fillStyle = '#222';
            ctx.fillRect(this.x + 6, this.y + 16, 3, 3);
            ctx.fillRect(this.x + 14, this.y + 8, 3, 3);
            ctx.fillRect(this.x + 22, this.y + 20, 3, 3);
            
            // Head
            ctx.fillStyle = '#4a6a3a';
            ctx.fillRect(this.x + 4, this.y, 24, 16);
            
            // Hollow eyes
            ctx.fillStyle = '#000';
            ctx.fillRect(this.x + 8, this.y + 4, 6, 6);
            ctx.fillRect(this.x + 18, this.y + 4, 6, 6);
            ctx.fillStyle = '#FFF';
            ctx.fillRect(this.x + 9, this.y + 5, 2, 2);
            ctx.fillRect(this.x + 19, this.y + 5, 2, 2);
            
            // Arms outstretched
            let armWave = Math.sin(this.animFrame * 0.08) * 3;
            ctx.fillStyle = '#3a5a2a';
            ctx.fillRect(this.x - 4, this.y + 12 + armWave, 6, 8);
            ctx.fillRect(this.x + 30, this.y + 12 - armWave, 6, 8);
            
            // Shambling legs
            let legOff = Math.sin(this.animFrame * 0.1) * 5;
            ctx.fillRect(this.x + 6, this.y + 32 + legOff, 8, 12 - legOff);
            ctx.fillRect(this.x + 18, this.y + 32 - legOff, 8, 12 + legOff);
            
        } else if (this.type === 'shooter') {
            // SHOOTER - dark purple hooded figure
            ctx.fillStyle = '#3a1a4a';
            ctx.fillRect(this.x + 4, this.y + 8, 24, 24);
            ctx.fillStyle = '#2a0a3a';
            ctx.fillRect(this.x + 4, this.y + 8, 24, 6);
            
            // Head
            ctx.fillStyle = '#4a2a5a';
            ctx.fillRect(this.x + 6, this.y, 20, 16);
            
            // Glowing eyes
            ctx.fillStyle = '#AA44FF';
            ctx.fillRect(this.x + 10, this.y + 4, 4, 4);
            ctx.fillRect(this.x + 18, this.y + 4, 4, 4);
            
            // Arms (throwing)
            let throwAnim = Math.sin(this.animFrame * 0.15) * 4;
            ctx.fillStyle = '#3a1a4a';
            ctx.fillRect(this.x + 28, this.y + 8 + throwAnim, 8, 6);
            ctx.fillRect(this.x - 4, this.y + 8 - throwAnim, 8, 6);
            
            // Legs
            ctx.fillRect(this.x + 8, this.y + 32, 6, 8);
            ctx.fillRect(this.x + 18, this.y + 32, 6, 8);
            
        } else {
            // Basic enemy
            ctx.fillStyle = '#8B0000';
            ctx.fillRect(this.x + 4, this.y + 8, 24, 24);
            ctx.fillStyle = '#FFFF00';
            ctx.fillRect(this.x + 8, this.y + 12, 6, 6);
            ctx.fillRect(this.x + 18, this.y + 12, 6, 6);
            let legOffset = Math.sin(this.animFrame * 0.2) * 4;
            ctx.fillRect(this.x + 6, this.y + 32 + legOffset, 8, 8 - legOffset);
            ctx.fillRect(this.x + 18, this.y + 32 - legOffset, 8, 8 + legOffset);
        }
        
        ctx.restore();
    }
}

// ============================================
// LEVEL DATA
// ============================================
const LEVELS = [
    // Level 1: Tutorial
    {
        platforms: [
            { x: 0, y: 550, width: 800, height: 50 },
            { x: 200, y: 480, width: 150, height: 20 },
            { x: 450, y: 420, width: 150, height: 20 },
            { x: 650, y: 500, width: 150, height: 50 },
        ],
        enemies: [{ x: 500, y: 380, type: 'basic' }],
        noodles: [
            { x: 260, y: 440, width: 16, height: 16 },
            { x: 510, y: 380, width: 16, height: 16 },
            { x: 700, y: 460, width: 16, height: 16 },
        ],
        powerups: [{ x: 350, y: 385, type: 'steak' }],
        startX: 50, startY: 480,
        exit: { x: 720, y: 450, width: 40, height: 50 }
    },
    // Level 2: Staircase challenge
    {
        platforms: [
            { x: 0, y: 550, width: 800, height: 50 },
            { x: 200, y: 480, width: 120, height: 20 },
            { x: 380, y: 420, width: 120, height: 20 },
            { x: 550, y: 360, width: 120, height: 20 },
            { x: 380, y: 300, width: 120, height: 20 },
            { x: 200, y: 240, width: 120, height: 20 },
            { x: 50, y: 180, width: 150, height: 20 },
            { x: 600, y: 300, width: 150, height: 20 },
        ],
        enemies: [
            { x: 420, y: 380, type: 'basic' },
            { x: 230, y: 200, type: 'basic' }
        ],
        noodles: [
            { x: 250, y: 440, width: 16, height: 16 },
            { x: 430, y: 380, width: 16, height: 16 },
            { x: 600, y: 320, width: 16, height: 16 },
            { x: 430, y: 260, width: 16, height: 16 },
            { x: 250, y: 200, width: 16, height: 16 },
            { x: 100, y: 140, width: 16, height: 16 },
            { x: 660, y: 260, width: 16, height: 16 },
        ],
        startX: 30, startY: 480,
        exit: { x: 650, y: 250, width: 40, height: 50 }
    },
    // Level 3: Tower climb
    {
        platforms: [
            { x: 0, y: 550, width: 800, height: 50 },
            { x: 150, y: 480, width: 120, height: 20 },
            { x: 320, y: 420, width: 120, height: 20 },
            { x: 490, y: 360, width: 120, height: 20 },
            { x: 320, y: 300, width: 120, height: 20 },
            { x: 150, y: 240, width: 120, height: 20 },
            { x: 320, y: 180, width: 160, height: 20 },
        ],
        enemies: [
            { x: 350, y: 380, type: 'basic' },
            { x: 520, y: 320, type: 'basic' },
            { x: 190, y: 200, type: 'basic' }
        ],
        noodles: [
            { x: 200, y: 440, width: 16, height: 16 },
            { x: 370, y: 380, width: 16, height: 16 },
            { x: 540, y: 320, width: 16, height: 16 },
            { x: 370, y: 260, width: 16, height: 16 },
            { x: 200, y: 200, width: 16, height: 16 },
            { x: 390, y: 140, width: 16, height: 16 },
        ],
        startX: 50, startY: 480,
        exit: { x: 380, y: 130, width: 40, height: 50 }
    },
    // Level 4: The Gauntlet
    {
        platforms: [
            { x: 0, y: 550, width: 200, height: 50 },
            { x: 250, y: 500, width: 100, height: 20 },
            { x: 400, y: 450, width: 100, height: 20 },
            { x: 550, y: 400, width: 120, height: 20 },
            { x: 400, y: 350, width: 100, height: 20 },
            { x: 220, y: 300, width: 100, height: 20 },
            { x: 80, y: 250, width: 100, height: 20 },
            { x: 250, y: 200, width: 100, height: 20 },
            { x: 420, y: 200, width: 100, height: 20 },
            { x: 600, y: 200, width: 150, height: 20 },
        ],
        enemies: [
            { x: 270, y: 460, type: 'basic' },
            { x: 570, y: 360, type: 'basic' },
            { x: 280, y: 160, type: 'basic' }
        ],
        noodles: [
            { x: 290, y: 460, width: 16, height: 16 },
            { x: 440, y: 410, width: 16, height: 16 },
            { x: 590, y: 360, width: 16, height: 16 },
            { x: 440, y: 310, width: 16, height: 16 },
            { x: 260, y: 260, width: 16, height: 16 },
            { x: 120, y: 210, width: 16, height: 16 },
            { x: 660, y: 160, width: 16, height: 16 },
        ],
        startX: 50, startY: 480,
        exit: { x: 650, y: 150, width: 40, height: 50 }
    },
    // Level 5: Boss Temple
    {
        platforms: [
            { x: 0, y: 550, width: 800, height: 50 },
            { x: 80, y: 460, width: 140, height: 20 },
            { x: 580, y: 460, width: 140, height: 20 },
            { x: 200, y: 380, width: 100, height: 20 },
            { x: 500, y: 380, width: 100, height: 20 },
            { x: 350, y: 320, width: 100, height: 20 },
        ],
        enemies: [{ x: 370, y: 280, type: 'boss' }],
        noodles: [
            { x: 140, y: 420, width: 16, height: 16 },
            { x: 640, y: 420, width: 16, height: 16 },
            { x: 240, y: 340, width: 16, height: 16 },
            { x: 540, y: 340, width: 16, height: 16 },
            { x: 390, y: 280, width: 16, height: 16 },
        ],
        powerups: [{ x: 350, y: 280, type: 'steak' }],
        startX: 50, startY: 480,
        exit: null
    },
    // Level 6: The Escape
    {
        platforms: [
            { x: 0, y: 550, width: 800, height: 50 },
            { x: 100, y: 480, width: 100, height: 20 },
            { x: 280, y: 420, width: 100, height: 20 },
            { x: 460, y: 370, width: 100, height: 20 },
            { x: 280, y: 320, width: 100, height: 20 },
            { x: 100, y: 270, width: 100, height: 20 },
            { x: 300, y: 220, width: 120, height: 20 },
            { x: 550, y: 220, width: 120, height: 20 },
            { x: 680, y: 170, width: 120, height: 20 },
        ],
        enemies: [
            { x: 310, y: 380, type: 'basic' },
            { x: 130, y: 230, type: 'basic' },
            { x: 580, y: 180, type: 'basic' },
            { x: 200, y: 400, type: 'basic' }
        ],
        noodles: [
            { x: 150, y: 440, width: 16, height: 16 },
            { x: 330, y: 380, width: 16, height: 16 },
            { x: 510, y: 330, width: 16, height: 16 },
            { x: 330, y: 280, width: 16, height: 16 },
            { x: 150, y: 230, width: 16, height: 16 },
            { x: 720, y: 130, width: 16, height: 16 },
        ],
        startX: 50, startY: 480,
        exit: { x: 730, y: 120, width: 40, height: 50 }
    },
    // Level 7: Shadow Swarm
    {
        platforms: [
            { x: 0, y: 550, width: 800, height: 50 },
            { x: 80, y: 480, width: 120, height: 20 },
            { x: 260, y: 440, width: 100, height: 20 },
            { x: 440, y: 400, width: 100, height: 20 },
            { x: 600, y: 360, width: 120, height: 20 },
            { x: 440, y: 320, width: 100, height: 20 },
            { x: 260, y: 280, width: 100, height: 20 },
            { x: 80, y: 240, width: 100, height: 20 },
            { x: 250, y: 200, width: 120, height: 20 },
            { x: 500, y: 200, width: 150, height: 20 },
        ],
        enemies: [
            { x: 300, y: 400, type: 'basic' },
            { x: 460, y: 360, type: 'basic' },
            { x: 300, y: 240, type: 'basic' },
            { x: 120, y: 200, type: 'basic' },
            { x: 550, y: 160, type: 'basic' }
        ],
        noodles: [
            { x: 130, y: 440, width: 16, height: 16 },
            { x: 310, y: 400, width: 16, height: 16 },
            { x: 490, y: 360, width: 16, height: 16 },
            { x: 650, y: 320, width: 16, height: 16 },
            { x: 310, y: 240, width: 16, height: 16 },
            { x: 130, y: 200, width: 16, height: 16 },
            { x: 580, y: 160, width: 16, height: 16 },
        ],
        startX: 50, startY: 480,
        exit: { x: 600, y: 150, width: 40, height: 50 }
    },
    // Level 8: Mutant's Awakening - the first mutant boss
    {
        platforms: [
            { x: 0, y: 550, width: 800, height: 50 },
            { x: 60, y: 460, width: 140, height: 20 },
            { x: 600, y: 460, width: 140, height: 20 },
            { x: 180, y: 380, width: 120, height: 20 },
            { x: 500, y: 380, width: 120, height: 20 },
            { x: 320, y: 300, width: 160, height: 20 },
        ],
        enemies: [{ x: 350, y: 260, type: 'finalboss' }],
        noodles: [
            { x: 110, y: 420, width: 16, height: 16 },
            { x: 660, y: 420, width: 16, height: 16 },
            { x: 230, y: 340, width: 16, height: 16 },
            { x: 560, y: 340, width: 16, height: 16 },
            { x: 380, y: 260, width: 16, height: 16 },
        ],
        powerups: [
            { x: 110, y: 425, type: 'steak' },
            { x: 660, y: 425, type: 'speed' }
        ],
        hazards: [{ x: 0, y: 535, width: 800, height: 15 }], // toxic floor edge
        startX: 50, startY: 480,
        exit: null
    },
    // Level 9: Toxic Sewer - swimming and zombies
    {
        platforms: [
            { x: 0, y: 550, width: 800, height: 50 },
            { x: 0, y: 480, width: 120, height: 20 },
            { x: 200, y: 500, width: 100, height: 20 },
            { x: 380, y: 510, width: 40, height: 20 },
            { x: 500, y: 480, width: 120, height: 20 },
            { x: 700, y: 470, width: 100, height: 20 },
            { x: 300, y: 430, width: 80, height: 20 },
            { x: 550, y: 400, width: 100, height: 20 },
            { x: 100, y: 380, width: 80, height: 20 },
            { x: 400, y: 350, width: 100, height: 20 },
            { x: 650, y: 350, width: 120, height: 20 },
        ],
        enemies: [
            { x: 220, y: 460, type: 'zombie' },
            { x: 540, y: 440, type: 'zombie' },
            { x: 140, y: 340, type: 'zombie' },
            { x: 450, y: 310, type: 'zombie' },
            { x: 700, y: 310, type: 'basic' }
        ],
        noodles: [
            { x: 60, y: 440, width: 16, height: 16 },
            { x: 250, y: 460, width: 16, height: 16 },
            { x: 420, y: 470, width: 16, height: 16 },
            { x: 550, y: 440, width: 16, height: 16 },
            { x: 350, y: 390, width: 16, height: 16 },
            { x: 600, y: 360, width: 16, height: 16 },
            { x: 150, y: 340, width: 16, height: 16 },
            { x: 710, y: 310, width: 16, height: 16 },
        ],
        water: [
            { x: 0, y: 520, width: 800, height: 35 },
            { x: 160, y: 410, width: 100, height: 30 },
            { x: 450, y: 440, width: 40, height: 30 },
            { x: 680, y: 400, width: 120, height: 30 },
        ],
        powerups: [
            { x: 200, y: 500, type: 'steak' },
            { x: 460, y: 350, type: 'shuriken' }
        ],
        startX: 30, startY: 480,
        exit: { x: 700, y: 300, width: 40, height: 50 }
    },
    // Level 10: The Hive - gauntlet with moving platforms and shooters
    {
        platforms: [
            { x: 0, y: 550, width: 800, height: 50 },
            { x: 50, y: 480, width: 100, height: 20 },
            { x: 200, y: 430, width: 100, height: 20 },
            { x: 380, y: 450, width: 80, height: 20, moveType: 'horizontal', moveRange: 80, moveSpeed: 1.5 },
            { x: 520, y: 420, width: 100, height: 20 },
            { x: 300, y: 370, width: 80, height: 20 },
            { x: 100, y: 340, width: 80, height: 20, moveType: 'horizontal', moveRange: 60, moveSpeed: 1 },
            { x: 500, y: 320, width: 100, height: 20 },
            { x: 650, y: 360, width: 80, height: 20 },
            { x: 200, y: 280, width: 80, height: 20 },
            { x: 400, y: 250, width: 100, height: 20 },
            { x: 600, y: 250, width: 120, height: 20 },
        ],
        enemies: [
            { x: 240, y: 390, type: 'zombie' },
            { x: 580, y: 380, type: 'shooter' },
            { x: 140, y: 300, type: 'zombie' },
            { x: 550, y: 280, type: 'shooter' },
            { x: 650, y: 320, type: 'basic' },
            { x: 250, y: 240, type: 'basic' }
        ],
        noodles: [
            { x: 100, y: 440, width: 16, height: 16 },
            { x: 420, y: 410, width: 16, height: 16 },
            { x: 570, y: 380, width: 16, height: 16 },
            { x: 350, y: 330, width: 16, height: 16 },
            { x: 140, y: 300, width: 16, height: 16 },
            { x: 550, y: 280, width: 16, height: 16 },
            { x: 450, y: 210, width: 16, height: 16 },
            { x: 660, y: 210, width: 16, height: 16 },
        ],
        water: [
            { x: 300, y: 530, width: 200, height: 22 },
        ],
        hazards: [
            { x: 200, y: 530, width: 100, height: 20 },
            { x: 500, y: 530, width: 100, height: 20 },
        ],
        powerups: [
            { x: 380, y: 415, type: 'steak' },
            { x: 500, y: 280, type: 'damage' },
            { x: 660, y: 210, type: 'star' },
        ],
        startX: 30, startY: 480,
        exit: { x: 650, y: 200, width: 40, height: 50 }
    },
    // Level 11: Mutant's Lair - final mutant boss
    {
        platforms: [
            { x: 0, y: 550, width: 800, height: 50 },
            { x: 60, y: 470, width: 130, height: 20 },
            { x: 610, y: 470, width: 130, height: 20 },
            { x: 180, y: 390, width: 100, height: 20 },
            { x: 520, y: 390, width: 100, height: 20 },
            { x: 320, y: 320, width: 160, height: 20 },
            { x: 80, y: 320, width: 80, height: 20 },
            { x: 640, y: 320, width: 80, height: 20 },
        ],
        enemies: [
            { x: 350, y: 280, type: 'finalboss' },
            { x: 200, y: 350, type: 'zombie' },
            { x: 550, y: 350, type: 'zombie' },
        ],
        noodles: [
            { x: 110, y: 430, width: 16, height: 16 },
            { x: 640, y: 430, width: 16, height: 16 },
            { x: 220, y: 350, width: 16, height: 16 },
            { x: 560, y: 350, width: 16, height: 16 },
            { x: 380, y: 280, width: 16, height: 16 },
            { x: 120, y: 280, width: 16, height: 16 },
            { x: 680, y: 280, width: 16, height: 16 },
        ],
        water: [
            { x: 0, y: 530, width: 800, height: 22 },
        ],
        hazards: [
            { x: 0, y: 525, width: 800, height: 25 },
        ],
        powerups: [
            { x: 110, y: 435, type: 'steak' },
            { x: 640, y: 435, type: 'steak' },
            { x: 380, y: 285, type: 'damage' },
            { x: 380, y: 285, type: 'star' },
        ],
        startX: 50, startY: 480,
        exit: null
    }
];

let currentLevelData = null;
let player = null;

// ============================================
// INITIALIZATION
// ============================================
function initLevel(levelIndex) {
    currentLevel = levelIndex;
    const level = LEVELS[levelIndex];
    
    if (player) {
        totalNoodles += player.noodles;
    }
    
    // Deep copy platforms with moving platform state
    let platforms = level.platforms.map(p => ({
        ...p,
        origX: p.x,
        origY: p.y,
        vx: 0,
        moveTimer: Math.random() * 100
    }));
    
    currentLevelData = {
        platforms: platforms,
        enemies: level.enemies.map(e => new Enemy(e.x, e.y, e.type)),
        noodles: level.noodles ? [...level.noodles] : [],
        water: level.water ? level.water.map(w => ({...w})) : [],
        hazards: level.hazards ? level.hazards.map(h => ({...h})) : [],
        powerups: level.powerups ? level.powerups.map(p => ({...p})) : [],
        startX: level.startX,
        startY: level.startY,
        exit: level.exit
    };
    
    projectiles = [];
    player = new Player(level.startX, level.startY, selectedCharacter);
    player.noodles = totalNoodles;
}

function nextLevel() {
    if (currentLevel < LEVELS.length - 1) {
        initLevel(currentLevel + 1);
    } else {
        gameState = 'VICTORY';
    }
}

function restartGame() {
    currentLevel = 0;
    totalNoodles = 0;
    gameState = 'CHARACTER_SELECT';
}

// ============================================
// RENDERING
// ============================================
function drawPixelText(text, x, y, size = 20, color = '#FFF') {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
}

function drawCharacterSelect() {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title
    drawPixelText('TEENAGE MUTANT CROCODILE', canvas.width / 2, 60, 32, '#FFD700');
    drawPixelText('NINJA FIGHTERS', canvas.width / 2, 100, 32, '#FFD700');
    
    drawPixelText('Choose Your Character!', canvas.width / 2, 160, 24, '#FFF');
    
    // Character boxes
    for (let i = 0; i < CHARACTERS.length; i++) {
        let x = 100 + i * 180;
        let y = 220;
        let char = CHARACTERS[i];
        
        // Selection highlight
        if (i === selectedCharacter) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 4;
            ctx.strokeRect(x - 10, y - 10, 160, 260);
        }
        
        // Box
        ctx.fillStyle = '#2a2a4e';
        ctx.fillRect(x, y, 140, 240);
        
        // Tail
        ctx.fillStyle = '#1a6b1a';
        ctx.beginPath();
        ctx.moveTo(x + 40, y + 100);
        ctx.lineTo(x + 15, y + 95);
        ctx.lineTo(x + 20, y + 110);
        ctx.lineTo(x + 40, y + 115);
        ctx.fill();
        
        // Character preview (pixel art style crocodile)
        // Body
        ctx.fillStyle = '#228B22';
        ctx.fillRect(x + 35, y + 85, 50, 45);
        // Scales
        ctx.fillStyle = '#1a6b1a';
        ctx.fillRect(x + 42, y + 90, 6, 6);
        ctx.fillRect(x + 55, y + 95, 6, 6);
        ctx.fillRect(x + 68, y + 90, 6, 6);
        
        // Belly
        ctx.fillStyle = '#90EE90';
        ctx.fillRect(x + 45, y + 115, 30, 12);
        
        // Head with snout
        ctx.fillStyle = '#228B22';
        ctx.fillRect(x + 55, y + 55, 45, 35);
        ctx.fillRect(x + 90, y + 65, 25, 20);
        
        // Eyes (on top)
        ctx.fillStyle = '#FFF';
        ctx.fillRect(x + 70, y + 50, 8, 8);
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 72, y + 52, 4, 4);
        // Eyebrow
        ctx.fillStyle = '#1a6b1a';
        ctx.fillRect(x + 65, y + 47, 18, 4);
        
        // Teeth
        ctx.fillStyle = '#FFF';
        ctx.fillRect(x + 95, y + 82, 3, 5);
        ctx.fillRect(x + 102, y + 82, 3, 5);
        ctx.fillRect(x + 109, y + 82, 3, 5);
        
        // Nostrils
        ctx.fillStyle = '#0F0';
        ctx.fillRect(x + 110, y + 70, 3, 3);
        
        // Bandana
        ctx.fillStyle = char.bandana;
        ctx.fillRect(x + 45, y + 78, 60, 10);
        ctx.fillRect(x + 30, y + 80, 18, 6);
        ctx.fillRect(x + 32, y + 85, 12, 5);
        
        // Weapon preview
        ctx.fillStyle = '#8B4513';
        if (char.weapon === 'staff') {
            ctx.fillRect(x + 50, y + 55, 4, 35);
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(x + 48, y + 52, 8, 6);
        } else if (char.weapon === 'swords') {
            ctx.fillStyle = '#C0C0C0';
            ctx.fillRect(x + 48, y + 60, 3, 20);
            ctx.fillRect(x + 55, y + 60, 3, 20);
            ctx.fillStyle = '#8B0000';
            ctx.fillRect(x + 45, y + 78, 16, 4);
        } else if (char.weapon === 'nunchucks') {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(x + 85, y + 75, 5, 10);
            ctx.fillRect(x + 92, y + 78, 4, 8);
        } else if (char.weapon === 'sais') {
            ctx.fillStyle = '#C0C0C0';
            ctx.fillRect(x + 85, y + 70, 3, 15);
            ctx.fillRect(x + 90, y + 73, 3, 12);
        }
        
        // Legs with claws
        ctx.fillStyle = '#228B22';
        ctx.fillRect(x + 40, y + 130, 12, 15);
        ctx.fillRect(x + 70, y + 130, 12, 15);
        ctx.fillStyle = '#444';
        ctx.fillRect(x + 40, y + 142, 3, 5);
        ctx.fillRect(x + 46, y + 142, 3, 5);
        ctx.fillRect(x + 72, y + 142, 3, 5);
        ctx.fillRect(x + 78, y + 142, 3, 5);
        
        // Name
        drawPixelText(char.name, x + 70, y + 185, 20, char.bandana);
        
        // Weapon
        drawPixelText(char.weapon, x + 70, y + 215, 14, '#AAA');
    }
    
    drawPixelText('Press SPACE to Start!', canvas.width / 2, 520, 20, '#FFD700');
}

function drawHUD() {
    ctx.fillStyle = '#000';
    ctx.fillRect(10, 10, 204, 24);
    ctx.fillStyle = '#444';
    ctx.fillRect(12, 12, 200, 20);
    ctx.fillStyle = player.health > 50 ? '#0F0' : player.health > 25 ? '#FF0' : '#F00';
    ctx.fillRect(12, 12, (player.health / player.maxHealth) * 200, 20);
    ctx.fillStyle = '#FFF';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`HP: ${player.health}`, 16, 26);
    
    drawPixelText(`Lives: ${player.lives}`, canvas.width - 100, 26, 16, '#FFF');
    
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(canvas.width / 2 - 50, 12, 16, 16);
    drawPixelText(`x ${player.noodles}`, canvas.width / 2 + 10, 26, 16, '#FFD700');
    
    drawPixelText(`Level ${currentLevel + 1}/11`, canvas.width / 2, 55, 16, '#FFF');
    
    // Ability indicator
    ctx.fillStyle = player.abilityReady ? '#0F0' : '#666';
    ctx.fillRect(10, canvas.height - 30, 14, 14);
    ctx.fillStyle = '#FFF';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    let abilText = player.abilityReady ? 'ABILITY [SHIFT]' : `ABILITY ${Math.ceil(player.abilityCooldown / 60)}s`;
    ctx.fillText(abilText, 28, canvas.height - 19);
    
    if (player.hasShuriken) {
        ctx.fillStyle = player.shurikenCooldown > 0 ? '#666' : '#FFD700';
        ctx.fillRect(10, canvas.height - 50, 14, 14);
        ctx.fillStyle = '#FFF';
        ctx.font = '10px monospace';
        ctx.fillText(player.shurikenCooldown > 0 ? 'SHURIKEN...' : '[Z] SHURIKEN', 28, canvas.height - 39);
    }
    
    let yOff = 70;
    if (player.speedBoostTimer > 0) {
        ctx.fillStyle = '#0FF';
        ctx.fillRect(10, yOff, (player.speedBoostTimer / SPEED_BOOST_DURATION) * 80, 6);
        ctx.fillStyle = '#FFF';
        ctx.font = '10px monospace';
        ctx.fillText('SPEED', 94, yOff + 6);
        yOff += 8;
    }
    if (player.damageBoostTimer > 0) {
        ctx.fillStyle = '#F00';
        ctx.fillRect(10, yOff, (player.damageBoostTimer / DAMAGE_BOOST_DURATION) * 80, 6);
        ctx.fillStyle = '#FFF';
        ctx.font = '10px monospace';
        ctx.fillText('DMG+', 94, yOff + 6);
    }
    if (player.godMode) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawPixelText('GOD MODE', canvas.width / 2, canvas.height - 8, 14, '#FF0');
    }
}

function drawGame() {
    let bgColor = '#87CEEB';
    if (currentLevel === 4 || currentLevel === 5) bgColor = '#2a1a3a';
    else if (currentLevel === 6) bgColor = '#1a2a1a';
    else if (currentLevel === 7) bgColor = '#2a1a1a';
    else if (currentLevel === 8) bgColor = '#1a0a2a';
    else if (currentLevel === 9) bgColor = '#1a2a1a';
    else if (currentLevel === 10) bgColor = '#2a1a2a';
    else if (currentLevel === 11) bgColor = '#0a0a0a';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Level decorations
    if (currentLevel === 4) {
        ctx.fillStyle = '#1a0a2a'; ctx.fillRect(0, 0, 50, canvas.height); ctx.fillRect(canvas.width - 50, 0, 50, canvas.height);
        ctx.fillStyle = '#4a0080';
        for (let i = 0; i < 5; i++) { ctx.fillRect(60, 100 + i * 100, 20, 60); ctx.fillRect(canvas.width - 80, 100 + i * 100, 20, 60); }
    } else if (currentLevel === 5) {
        ctx.fillStyle = '#1a0a2a'; ctx.fillRect(0, 0, 40, canvas.height); ctx.fillRect(canvas.width - 40, 0, 40, canvas.height);
        ctx.fillStyle = '#4a3030';
        let sway = Math.sin(frameCount * 0.02) * 3;
        for (let i = 0; i < 4; i++) { ctx.fillRect(50 + sway, 120 + i * 130, 16, 50); ctx.fillRect(canvas.width - 66 - sway, 120 + i * 130, 16, 50); }
    } else if (currentLevel === 6) {
        ctx.fillStyle = '#0a1a0a';
        for (let i = 0; i < 6; i++) { let tx = 60 + i * 130; let s = Math.sin(frameCount * 0.01 + i) * 4; ctx.fillRect(tx + s, 100, 20, canvas.height - 100); ctx.fillRect(tx - 10 + s, 80, 40, 30); }
    } else if (currentLevel === 7) {
        // Level 8: Mutant's Awakening
        ctx.fillStyle = '#1a0a2a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < 8; i++) {
            let px = i * 100; let glow = Math.sin(frameCount * 0.03 + i) * 0.2 + 0.3;
            ctx.fillStyle = `rgba(100, 0, 150, ${glow})`;
            ctx.fillRect(px, 0, 10, canvas.height);
        }
    } else if (currentLevel === 8) {
        // Level 9: Toxic Sewer
        ctx.fillStyle = '#0a1a0a';
        for (let i = 0; i < 4; i++) { ctx.fillRect(i * 220 + 20, 100, 30, canvas.height - 100); ctx.fillRect(i * 220 + 40, 120, 15, canvas.height - 120); }
    } else if (currentLevel === 9) {
        // Level 10: The Hive
        ctx.fillStyle = '#1a0a1a';
        for (let i = 0; i < 10; i++) {
            let px = i * 85 + Math.sin(frameCount * 0.01 + i) * 5;
            ctx.fillRect(px, canvas.height - 80, 20, 40 + Math.sin(frameCount * 0.02 + i) * 10);
        }
    } else if (currentLevel === 10) {
        // Level 11: Mutant's Lair
        ctx.fillStyle = '#1a0a0a';
        for (let i = 0; i < 5; i++) {
            let px = 30 + i * 180;
            ctx.fillRect(px, 0, 15, canvas.height);
            ctx.fillStyle = `rgba(255, 100, 0, ${0.3 + Math.sin(frameCount * 0.05 + i) * 0.15})`;
            ctx.fillRect(px - 5, 0, 25, canvas.height);
            ctx.fillStyle = '#1a0a0a';
        }
    } else {
        ctx.fillStyle = '#FFF';
        ctx.fillRect(100 + Math.sin(frameCount * 0.01) * 20, 80, 80, 30);
        ctx.fillRect(500 + Math.sin(frameCount * 0.015) * 20, 120, 100, 40);
    }
    
    // Water zones (drawn before platforms)
    if (currentLevelData.water) {
        for (let w of currentLevelData.water) {
            ctx.fillStyle = 'rgba(0, 150, 200, 0.4)';
            ctx.fillRect(w.x, w.y, w.width, w.height);
            let waveOff = Math.sin(frameCount * 0.03) * 3;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(w.x + waveOff, w.y + 2, w.width, 3);
            ctx.fillRect(w.x - waveOff, w.y + 8, w.width, 2);
        }
    }
    
    // Platforms
    let platformColor = '#8B4513';
    let grassColor = '#228B22';
    if (currentLevel === 4) { platformColor = '#3a2a4a'; grassColor = '#5a4a6a'; }
    else if (currentLevel === 5) { platformColor = '#3a2a3a'; grassColor = '#5a3a3a'; }
    else if (currentLevel === 6) { platformColor = '#2a3a2a'; grassColor = '#3a5a3a'; }
    else if (currentLevel === 7) { platformColor = '#3a2a2a'; grassColor = '#5a3a3a'; }
    else if (currentLevel >= 8) { platformColor = '#2a2a3a'; grassColor = '#3a3a5a'; }
    
    ctx.fillStyle = platformColor;
    for (let platform of currentLevelData.platforms) {
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.fillStyle = grassColor;
        ctx.fillRect(platform.x, platform.y, platform.width, 6);
        ctx.fillStyle = platformColor;
    }
    
    // Hazards
    if (currentLevelData.hazards) {
        for (let h of currentLevelData.hazards) {
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(h.x, h.y, h.width, h.height);
            for (let i = 0; i < h.width; i += 12) {
                ctx.fillStyle = '#8B0000';
                ctx.beginPath();
                ctx.moveTo(h.x + i, h.y + h.height);
                ctx.lineTo(h.x + i + 6, h.y);
                ctx.lineTo(h.x + i + 12, h.y + h.height);
                ctx.fill();
            }
        }
    }
    
    // Exit door
    if (currentLevelData.exit) {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(currentLevelData.exit.x, currentLevelData.exit.y, currentLevelData.exit.width, currentLevelData.exit.height);
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(currentLevelData.exit.x + 5, currentLevelData.exit.y + 5, currentLevelData.exit.width - 10, currentLevelData.exit.height - 10);
    }
    
    // Power-ups
    if (currentLevelData.powerups) {
        for (let pu of currentLevelData.powerups) {
            let bob = Math.sin(frameCount * 0.05 + pu.x) * 3;
            ctx.fillStyle = pu.type === 'steak' ? '#8B4513' : pu.type === 'speed' ? '#00FFFF' : pu.type === 'damage' ? '#FF4444' : pu.type === 'star' ? '#FFFF00' : '#FFD700';
            ctx.fillRect(pu.x, pu.y + bob, POWERUP_SIZE, POWERUP_SIZE);
            ctx.fillStyle = '#FFF';
            ctx.font = '14px monospace';
            ctx.textAlign = 'center';
            let label = pu.type === 'steak' ? 'S' : pu.type === 'speed' ? '>' : pu.type === 'damage' ? 'D' : pu.type === 'star' ? '*' : 'Z';
            ctx.fillText(label, pu.x + POWERUP_SIZE/2, pu.y + bob + 15);
        }
    }
    
    // Noodles
    for (let noodle of currentLevelData.noodles) {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(noodle.x + 4, noodle.y + 4, 8, 8);
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(noodle.x + 2, noodle.y + 2, 12, 4);
    }
    
    // Projectiles
    for (let p of projectiles) p.draw();
    
    // Enemies
    for (let enemy of currentLevelData.enemies) enemy.draw();
    
    // Player
    player.draw();
    
    // Boss HP bar (big one at top)
    let bossEnemy = currentLevelData.enemies.find(e => (e.type === 'boss' || e.type === 'finalboss') && !e.dead);
    if (bossEnemy) {
        let barW = 300;
        let barX = (canvas.width - barW) / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(barX - 10, 70, barW + 20, 28);
        ctx.fillStyle = '#000';
        ctx.fillRect(barX, 74, barW, 18);
        ctx.fillStyle = bossEnemy.health < bossEnemy.maxHealth * 0.5 ? '#FF6600' : '#FF0000';
        ctx.fillRect(barX + 2, 76, (bossEnemy.health / bossEnemy.maxHealth) * (barW - 4), 14);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        let bossName = bossEnemy.type === 'finalboss' ? 'MUTANT BOSS' : 'BOSS';
        ctx.fillText(`${bossName} ${bossEnemy.health}/${bossEnemy.maxHealth}`, canvas.width / 2, 87);
    }
    
    // Attack effect
    if (player.attacking) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        let ax = player.facingRight ? player.x + player.width : player.x - 40;
        ctx.fillRect(ax, player.y, 40, player.height);
    }
    
    drawHUD();
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawPixelText('GAME OVER', canvas.width / 2, 250, 48, '#FF0000');
    drawPixelText('Press SPACE to Try Again', canvas.width / 2, 320, 20, '#FFF');
}

function drawVictory() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawPixelText('YOU WIN!', canvas.width / 2, 180, 48, '#FFD700');
    drawPixelText('You defeated the evil bosses', canvas.width / 2, 230, 20, '#FFF');
    drawPixelText('and saved the city!', canvas.width / 2, 260, 20, '#FFF');
    drawPixelText(`Total Noodles: ${player.noodles}`, canvas.width / 2, 310, 24, '#FFD700');
    drawPixelText('You are a true ninja crocodile!', canvas.width / 2, 360, 18, '#90EE90');
    drawPixelText('Press SPACE to Play Again', canvas.width / 2, 420, 20, '#FFF');
}

// ============================================
// MAIN GAME LOOP
// ============================================
function update() {
    frameCount++;
    
    if (gameState === 'PLAYING') {
        // Update moving platforms
        for (let platform of currentLevelData.platforms) {
            if (platform.moveType === 'horizontal') {
                platform.moveTimer += platform.moveSpeed || 1;
                let offset = Math.sin(platform.moveTimer * 0.02) * (platform.moveRange || 80);
                let prevX = platform.x;
                platform.x = platform.origX + offset;
                platform.vx = platform.x - prevX;
            } else if (platform.moveType === 'vertical') {
                platform.moveTimer += platform.moveSpeed || 1;
                let offset = Math.sin(platform.moveTimer * 0.02) * (platform.moveRange || 60);
                platform.y = platform.origY + offset;
            } else {
                platform.vx = 0;
            }
        }
        
        // Update projectiles
        for (let p of projectiles) p.update();
        projectiles = projectiles.filter(p => !p.dead);
        
        player.update();
        
        for (let enemy of currentLevelData.enemies) {
            enemy.update();
        }
        
        // Check boss defeat
        let bossEnemy = currentLevelData.enemies.find(e => e.type === 'boss' || e.type === 'finalboss');
        if (bossEnemy && bossEnemy.dead && !bossEnemy._victoryTriggered) {
            bossEnemy._victoryTriggered = true;
            if (currentLevel === LEVELS.length - 1) {
                SoundFX.victory();
                setTimeout(() => { gameState = 'VICTORY'; }, 1000);
            } else if (!currentLevelData.exit) {
                currentLevelData.exit = { x: 660, y: 410, width: 40, height: 50 };
                SoundFX.collect();
            }
        }
    }
}

function draw() {
    if (gameState === 'CHARACTER_SELECT') {
        drawCharacterSelect();
    } else if (gameState === 'PLAYING') {
        drawGame();
    } else if (gameState === 'GAME_OVER') {
        drawGame();
        drawGameOver();
    } else if (gameState === 'VICTORY') {
        drawGame();
        drawVictory();
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Input for menus
document.addEventListener('keydown', (e) => {
    if (gameState === 'CHARACTER_SELECT') {
        if (e.code === 'ArrowLeft') {
            selectedCharacter = (selectedCharacter - 1 + CHARACTERS.length) % CHARACTERS.length;
        } else if (e.code === 'ArrowRight') {
            selectedCharacter = (selectedCharacter + 1) % CHARACTERS.length;
        } else if (e.code === 'Space') {
            initLevel(0);
            gameState = 'PLAYING';
        }
    } else if (gameState === 'GAME_OVER' || gameState === 'VICTORY') {
        if (e.code === 'Space') {
            restartGame();
        }
    }
});

// Start the game
drawCharacterSelect();
gameLoop();
