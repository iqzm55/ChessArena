// Chess game sound effects using Web Audio API
class ChessSounds {
  private audioContext: AudioContext | null = null;
  
  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }
  
  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    const ctx = this.getContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }
  
  move() {
    this.playTone(600, 0.08, 'sine', 0.2);
    setTimeout(() => this.playTone(800, 0.06, 'sine', 0.15), 50);
  }
  
  capture() {
    this.playTone(300, 0.15, 'sawtooth', 0.2);
    this.playTone(200, 0.1, 'square', 0.1);
  }
  
  check() {
    this.playTone(880, 0.1, 'square', 0.25);
    setTimeout(() => this.playTone(660, 0.15, 'square', 0.2), 100);
  }
  
  checkmate() {
    this.playTone(880, 0.15, 'square', 0.3);
    setTimeout(() => this.playTone(660, 0.15, 'square', 0.25), 150);
    setTimeout(() => this.playTone(440, 0.2, 'square', 0.3), 300);
    setTimeout(() => this.playTone(330, 0.3, 'sawtooth', 0.2), 500);
  }
  
  illegal() {
    this.playTone(150, 0.2, 'sawtooth', 0.15);
  }
  
  gameStart() {
    this.playTone(440, 0.1, 'sine', 0.2);
    setTimeout(() => this.playTone(550, 0.1, 'sine', 0.2), 100);
    setTimeout(() => this.playTone(660, 0.15, 'sine', 0.25), 200);
  }
  
  lowTime() {
    this.playTone(1000, 0.05, 'square', 0.3);
  }
}

export const chessSounds = new ChessSounds();
