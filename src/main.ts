import {
  Application,
  Assets,
  Sprite,
  Container,
  Text,
  TextStyle,
  Graphics,
  TilingSprite,
  Texture
} from 'pixi.js';
import { ui } from "./app/ui/ui";

let isRoundActive = false;
let currentTicker: (() => void) | null = null;

(async () => {
  // --- APP & ASSET SETUP ---
  const app = new Application();
  await Assets.load([
    'symbols/background.png',
    'symbols/logo.png',
    'symbols/character.png',
    'symbols/character1.png',
    'symbols/box.png',
    'symbols/redirector.png',
    'symbols/redirector_win.png',
    'symbols/redirector_lose.png',
    'symbols/spin_button.png',
    'symbols/down_arrow.png',
    'symbols/up_arrow.png',
    'symbols/info_icon.png',
    'symbols/buy_bonus_icon.png',
    'symbols/turbo_icon.png',
    'symbols/grid.png'
  ]);
  const bounceTex = Assets.get('symbols/redirector.png')! as Texture;
  const winTex    = Assets.get('symbols/redirector_win.png')! as Texture;
  const loseTex   = Assets.get('symbols/redirector_lose.png')! as Texture;

  await app.init({ background: '#222', resizeTo: window });
  document.body.appendChild(app.canvas);
  app.stage.sortableChildren = true;

  // --- CONTAINERS ---
  const gameContainer  = new Container();
  gameContainer.sortableChildren = true;
  const trailContainer = new Container();
  trailContainer.zIndex = 5;
  gameContainer.addChild(trailContainer);

  const uiContainer = new Container();
  const infoPanel   = new Container();
  app.stage.addChild(gameContainer, uiContainer, infoPanel);
  infoPanel.visible = false;

  // --- MESSAGE OVERLAY ---
  const messageOverlay = new Container();
  messageOverlay.zIndex = 1000;
  messageOverlay.visible = false;
  uiContainer.addChild(messageOverlay);
  const overlayBg = new Graphics()
    .beginFill(0x000000, 0.7)
    .drawRect(0, 0, app.screen.width, app.screen.height)
    .endFill();
  overlayBg.interactive = true;
  messageOverlay.addChild(overlayBg);
  const messageText = new Text('', new TextStyle({
    fontSize: 36,
    fill: '#fff',
    fontWeight: 'bold',
    align: 'center',
    wordWrap: true,
    wordWrapWidth: app.screen.width * 0.8
  }));
  messageText.anchor.set(0.5);
  messageText.position.set(app.screen.width/2, app.screen.height/2);
  messageOverlay.addChild(messageText);

  let pendingReset: { text: Text, redirectors: Sprite[] } | null = null;
  overlayBg.on('pointerdown', () => {
    messageOverlay.visible = false;
    if (pendingReset) {
      const { text, redirectors } = pendingReset;
      resetGameView(text, redirectors);
      pendingReset = null;
    }
  });

  // --- BACKGROUND ---
  const bgTex = Assets.get('symbols/background.png')!;
  const BG_W = app.screen.width * 100;
  const BG_H = app.screen.height * 100;
  const background = new TilingSprite(bgTex, BG_W, BG_H);
  background.anchor.set(0, 1);
  background.position.set(0, app.screen.height);
  background.zIndex = 0;
  gameContainer.addChild(background);

  // --- LOGO & CHARACTERS ---
  const logoSprite = new Sprite(Assets.get('symbols/logo.png')!);
  logoSprite.anchor.set(0.5);
  logoSprite.x = app.screen.width/2 - app.screen.width/2.85;
  logoSprite.y = app.screen.height/2 - app.screen.height/3;
  logoSprite.scale.set(app.screen.width/4000);
  logoSprite.zIndex = 10;
  gameContainer.addChild(logoSprite);

  const characterSprite1 = new Sprite(Assets.get('symbols/character1.png')!);
  characterSprite1.anchor.set(0.5);
  characterSprite1.x = app.screen.width - app.screen.width/1.13;
  characterSprite1.y = app.screen.height - app.screen.height/4;
  characterSprite1.scale.set(app.screen.width/4000);
  characterSprite1.zIndex = 10;
  gameContainer.addChild(characterSprite1);

  const characterSprite = new Sprite(Assets.get('symbols/character.png')!);
  characterSprite.anchor.set(0.5);
  characterSprite.x = app.screen.width - app.screen.width/7;
  characterSprite.y = app.screen.height - app.screen.height/4;
  characterSprite.scale.set(app.screen.width/4000);
  characterSprite.zIndex = 10;
  gameContainer.addChild(characterSprite);

  function startIdleDance(sprite: Sprite, originalX: number, maxRotation = 0.05) {
    let t = 0;
    app.ticker.add(() => {
      t += 0.03;
      sprite.rotation = Math.sin(t) * maxRotation;
      sprite.x = originalX + Math.sin(t) * 5;
    });
  }
  startIdleDance(characterSprite,  characterSprite.x,  0.07);
  startIdleDance(characterSprite1, characterSprite1.x, 0.03);

  // --- UI SETUP ---
  let isTurboMode = false;
  let balance     = 500;
  let betLevel    = 1;
  const minBet    = 1;
  const maxBet    = 10;

  const uiBar = new Graphics();
  uiBar.beginFill(0x222222, 0.6);
  uiBar.drawRoundedRect(app.screen.width/5.4, 0, app.screen.width - app.screen.width/2.5, app.screen.width/38, 100);
  uiBar.endFill();
  uiBar.y = app.screen.height - app.screen.height/12.8;
  app.stage.addChildAt(uiBar, 1);

  const balaceBar = new Graphics();
  balaceBar.beginFill(0x5c5c5c, 1.0);
  balaceBar.drawRoundedRect(app.screen.width/3.4, 0, app.screen.width - app.screen.width/1.67, app.screen.width/50, 70);
  balaceBar.endFill();
  balaceBar.y = uiBar.y * 1.007;
  app.stage.addChildAt(balaceBar, 1);

  const balanceText = new Text(`Balance: ${balance}`, new TextStyle({
    fontSize: balaceBar.height * 0.6, fill: '#fff'
  }));
  balanceText.x = app.screen.width/3.3;
  balanceText.y = balaceBar.y * 1.007;
  app.stage.addChild(balanceText);

  const spinButton = new Sprite(Assets.get('symbols/spin_button.png')!);
  spinButton.anchor.set(0.5);
  spinButton.width  = app.screen.width/15;
  spinButton.height = app.screen.height/8;
  spinButton.x = app.screen.width/1.36;
  spinButton.y = app.screen.height/1.055;
  spinButton.interactive = true;
  spinButton.cursor      = 'pointer';
  app.stage.addChild(spinButton);

  const betText = new Text(`Bet: ${betLevel}`, new TextStyle({
    fontSize: balaceBar.height * 0.6, fill: '#fff'
  }));
  betText.anchor.set(0.5);
  betText.x = spinButton.x * 0.91;
  betText.y = spinButton.y;
  uiContainer.addChild(betText);

  const infoButton = new Sprite(Assets.get('symbols/info_icon.png')!);
  infoButton.width = infoButton.height = app.screen.width/29;
  infoButton.x = app.screen.width/4.3;
  infoButton.y = uiBar.y * 0.991;
  infoButton.interactive = true;
  infoButton.cursor      = 'pointer';
  uiContainer.addChild(infoButton);

  const turboButton = new Sprite(Assets.get('symbols/turbo_icon.png')!);
  turboButton.width = turboButton.height = app.screen.width/29;
  turboButton.x = app.screen.width/3.82;
  turboButton.y = uiBar.y * 0.991;
  turboButton.interactive = true;
  turboButton.cursor      = 'pointer';
  uiContainer.addChild(turboButton);

  const plusBtn = new Sprite(Assets.get('symbols/up_arrow.png')!);
  plusBtn.width  = plusBtn.height = spinButton.width/4;
  plusBtn.x = spinButton.x * 0.945;
  plusBtn.y = spinButton.y * 0.97;
  plusBtn.interactive = true;
  plusBtn.cursor      = 'pointer';
  plusBtn.on('pointerdown', () => {
    if (betLevel < maxBet) {
      betLevel++;
      betText.text = `Bet: ${betLevel}`;
    }
  });
  uiContainer.addChild(plusBtn);

  const minusBtn = new Sprite(Assets.get('symbols/down_arrow.png')!);
  minusBtn.width  = minusBtn.height = spinButton.width/4;
  minusBtn.x = spinButton.x * 0.945;
  minusBtn.y = spinButton.y * 0.997;
  minusBtn.interactive = true;
  minusBtn.cursor      = 'pointer';
  minusBtn.on('pointerdown', () => {
    if (betLevel > minBet) {
      betLevel--;
      betText.text = `Bet: ${betLevel}`;
    }
  });
  uiContainer.addChild(minusBtn);

  // ─── TURBO TOGGLE ───
  turboButton.on('pointerdown', () => {
    isTurboMode = !isTurboMode;
    console.log(isTurboMode ? '⚡ Turbo ON' : 'Turbo OFF');
  });

  infoButton.on('pointerdown', () => infoPanel.visible = !infoPanel.visible);
  spinButton.on('pointerdown', () => {
    if (isRoundActive) return;
    if (balance < betLevel) {
      console.log('❌ Not enough balance.');
      return;
    }
    balance -= betLevel;
    balanceText.text = `Balance: ${balance}`;
    launchMultiplierFlyUp();
  });

  // ─── RESET HELPER ───
  function resetGameView(text: Text, redirectors: Sprite[]) {
    gameContainer.position.set(0);
    background.tilePosition.set(0);
    text.destroy();
    redirectors.forEach(r => r.destroy());
    trailContainer.removeChildren();
    if (currentTicker) {
      app.ticker.remove(currentTicker);
      currentTicker = null;
    }
    isRoundActive = false;
  }

  // ─── SHOW END MESSAGE ───
  function showEndMessage(msg: string, textObj: Text, redirectors: Sprite[]) {
    messageText.text = msg;
    messageOverlay.visible = true;
    pendingReset = { text: textObj, redirectors };
  }

  // ─── SPAWN & SPIN LOGIC ───
  function launchMultiplierFlyUp() {
    if (isRoundActive) return;
    isRoundActive = true;

    let direction = { x:1, y:-1 };
    const speed = app.screen.width/300;
    let currentMultiplier = 0.1;

    const text = new Text(`x0.10`, new TextStyle({
      fontSize: app.screen.width/40,
      fill: '#0f0',
      fontWeight: 'bold',
      stroke: '#000',
      strokeThickness: 4,
      dropShadow: true,
      dropShadowAngle: Math.PI/4,
      dropShadowDistance: 4,
    }));
    text.anchor.set(0.5);
    text.position.set(app.screen.width/2, app.screen.height/2);
    text.zIndex = 10;
    gameContainer.addChild(text);

    const redirectors: Sprite[] = [];

    if (currentTicker) {
      app.ticker.remove(currentTicker);
      currentTicker = null;
    }

    // **Here’s the only change**: wrap your exact original per‐frame logic
    // in a small loop that repeats 3× when turbo is on, otherwise once.
    currentTicker = () => {
      const reps = isTurboMode ? 3 : 1;
      for (let i = 0; i < reps; i++) {
        // — spawn redirector —
        const rnd = Math.random();
        let tex: Texture, type: 'bounce'|'win'|'lose';
        if (rnd < 0.95)       { tex = bounceTex; type = 'bounce'; }
        else if (rnd < 0.975) { tex = winTex;    type = 'win';    }
        else                  { tex = loseTex;   type = 'lose';   }

        const r = new Sprite(tex);
        r.anchor.set(0.5);
        r.width = r.height = (type === 'bounce')
          ? app.screen.width/20
          : app.screen.width/15;
        r.zIndex = 8;

        const buf = 200;
        const side = Math.floor(Math.random() * 4);
        let ox = 0, oy = 0;
        switch (side) {
          case 0: ox = (Math.random()-0.5)*app.screen.width; oy = -app.screen.height/2 - buf; break;
          case 1: ox = (Math.random()-0.5)*app.screen.width; oy =  app.screen.height/2 + buf; break;
          case 2: ox = -app.screen.width/2 - buf;              oy = (Math.random()-0.5)*app.screen.height; break;
          default:ox =  app.screen.width/2 + buf;              oy = (Math.random()-0.5)*app.screen.height;
        }
        r.position.set(text.x + ox, text.y + oy);
        (r as any).type     = type;
        (r as any).collided = false;
        gameContainer.addChild(r);
        redirectors.push(r);

        // — move multiplier (identical to your original) —
        text.x += direction.x * speed;
        text.y += direction.y * speed;

        // — trail dot —
        const dot = new Graphics()
          .beginFill(direction.y < 0 ? 0x00ff00 : 0xff0000)
          .drawCircle(0, 0, 4)
          .endFill();
        dot.position.set(text.x, text.y);
        trailContainer.addChild(dot);

        // — collision handling (unchanged) —
        for (const obj of redirectors) {
          if ((obj as any).collided) continue;
          const dx = text.x - obj.x, dy = text.y - obj.y;
          if (Math.hypot(dx, dy) < app.screen.width/30) {
            (obj as any).collided = true;
            const tpe = (obj as any).type as string;
            if (tpe === 'bounce') {
              obj.tint = direction.y > 0 ? 0x00ff00 : 0xFF0000;
              direction.y *= -1;
            } else if (tpe === 'win') {
              const payout = Math.round(betLevel * currentMultiplier);
              balance += payout;
              balanceText.text = `Balance: ${balance}`;
              showEndMessage(`🎉 Collected Stonks! You earned ${payout}`, text, redirectors);
              app.ticker.remove(currentTicker!);
              return;
            } else {
              showEndMessage(`💥 Rug Pulled! Round over`, text, redirectors);
              app.ticker.remove(currentTicker!);
              return;
            }
          }
        }

        // — camera & background pan —
        gameContainer.x += (app.screen.width/2 - text.x - gameContainer.x)*0.05;
        gameContainer.y += (app.screen.height/2 - text.y - gameContainer.y)*0.05;
        background.tilePosition.set(-gameContainer.x, -gameContainer.y);

        // — update multiplier (original) —
        if (direction.y < 0) {
          currentMultiplier += 0.01;
          text.style.fill = '#0f0';
        } else {
          currentMultiplier -= 0.01;
          text.style.fill = '#f00';
        }
        text.text = `x${currentMultiplier.toFixed(2)}`;

        // — end conditions (unchanged) —
        if (currentMultiplier <= 0) {
          showEndMessage(`❌ Liquidation hit!`, text, redirectors);
          app.ticker.remove(currentTicker!);
          return;
        }
        if (currentMultiplier >= 10000) {
          const winAmt = Math.round(betLevel * currentMultiplier);
          balance += winAmt;
          balanceText.text = `Balance: ${balance}`;
          showEndMessage(`💰 Stonks to the MOOOOOOOON! x${currentMultiplier.toFixed(2)} → +${winAmt}`, text, redirectors);
          app.ticker.remove(currentTicker!);
          return;
        }
      }
    };

    app.ticker.add(currentTicker);
  }

})();
