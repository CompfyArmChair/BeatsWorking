  
// =================================================================
// AUDIO LOOPER
// =================================================================

var SequencePreCue = 0;
var LoopState = Object.freeze({"stopped":1, "playing":2, "recording":3})

class LooperManager
{
    constructor()
    {
        this.Loopers = [];
    }

    StartRecording(channel, currentBeat, loopLength)
    {
        //console.log("Start recording: " + channel);
        if (this.Loopers[channel] == null)
        {
            this.Loopers[channel] = new Looper(loopLength);
        }
        this.Loopers[channel].StartRecording(currentBeat - SequencePreCue);
    }

    StartPlayback(channel, currentBeat)
    {
        //console.log("Start playback: " + channel);
        if (this.Loopers[channel] == null)
        {
            this.Loopers[channel] = new Looper();
        }
        this.Loopers[channel].StartPlayback(currentBeat);
    }

    Stop(channel)
    {
        if (this.Loopers[channel] != null)
            this.Loopers[channel].Stop();
    }

    Clear(channel)
    {
        if (this.Loopers[channel] != null)
            this.Loopers[channel].Clear();
    }

    Mute(channel)
    {
        if (this.Loopers[channel] != null)
            this.Loopers[channel].Mute();
    }

    Unmute(channel)
    {
        if (this.Loopers[channel] != null)
            this.Loopers[channel].Unmute();
    }

    SoundPlayed(currentBeat, channel, soundNumber)
    {
        //console.log("LooperManager tried to play sound");
        if (this.Loopers[channel] != null)
        {
            this.Loopers[channel].SoundPlayed(currentBeat, soundNumber);
        }
    }

    ProcessTick(currentBeat)
    {
        for (var key in this.Loopers)
        {
            var looper = this.Loopers[key];
            looper.ProcessTick(currentBeat);
        }
    }
}

class Looper
{
    constructor(loopLength)
    {
        if (loopLength == 0)
            this.LoopLength = 16;
        else
            this.LoopLength = loopLength;
        this.State = LoopState.stopped;
        this.Muted = false;
        this.StartBeat = 0;
        this.Events = [];
        this.CurrentEventIndex = 0;
        this.LastPosition = 0;
        this.HasPassedLastNote = false;
        this.QuantiseStrength = 1;
        this.QuantiseResolution = 0.125;
    }

    StartRecording(currentBeat)
    {
        this.StartBeat = currentBeat;
        this.State = LoopState.recording;
    }

    StartPlayback(currentBeat)
    {
        this.Events.sort(function(a, b) {
            return parseFloat(a.Beat) - parseFloat(b.Beat);
        });
        this.StartBeat = currentBeat;
        this.State = LoopState.playing;
        this.CurrentEventIndex = 0;
        this.LastPosition = 0;
        this.HasPassedLastNote = false;
        this.DebugOutputSequence();
    }

    DebugOutputSequence()
    {
        //console.log("SEQUENCE");
        for (var i = 0; i < this.Events.length; i++)
        {
            var ev = this.Events[i];
            //console.log(i + ": " + ev.Beat + " - " + ev.Note);
        }
    }

    Stop()
    {
        this.State = LoopState.stopped;
    }

    Clear()
    {
        this.Events = [];
    }

    Mute()
    {
        this.Muted = true;
    }

    Unmute()
    {
        this.Muted = false;
    }

    CurrentPosition(currentBeat)
    {
        return (currentBeat - this.StartBeat) % this.LoopLength;
    }

    SoundPlayed(currentBeat, soundNumber)
    {
        if (this.State != LoopState.recording)
            return;

        var position = this.CurrentPosition(currentBeat)
        position = this.QuantiseBeat(position);

        this.Events.push(new LooperNote(position, soundNumber));
    }

    QuantiseBeat(beat)
    {
        //console.log("INPUT BEAT: " + beat)
        if (this.QuantiseStrength > 0)
        {
            beat = beat / this.QuantiseResolution;
            beat = Math.round(beat);
            beat = beat * this.QuantiseResolution;
        }
        //console.log("QUANTISED BEAT: " + beat)
        return beat;
    }

    ProcessTick(currentBeat)
    {
        if (this.State != LoopState.playing)
            return;

        if (this.Events.length == 0)
            return;

        var position = this.CurrentPosition(currentBeat);

        //console.log("CurrentPosition: " + position);
        //console.log("CurrentBeat: " + currentBeat);
        //console.log("StartBeat: " + this.StartBeat);
        //console.log("this.Events.length: " + this.Events.length);

        if (this.LastPosition > position)
            this.HasPassedLastNote = false;
        else if (this.HasPassedLastNote)
            return;

        while (this.Events[this.CurrentEventIndex].Beat <= position)
        {
            if (!this.Muted)
            {
                playSoundFromLooper(this.Events[this.CurrentEventIndex].Note);
                //console.log("Looper played: NOTE " + this.Events[this.CurrentEventIndex].Note + " (INDEX " + this.CurrentEventIndex + "/" + this.Events.length + ") @ " + position);
            }
            this.CurrentEventIndex++;
            if (this.CurrentEventIndex == this.Events.length)
            {
                this.CurrentEventIndex = 0;
                this.HasPassedLastNote = true;
                break;
            }
        }

        this.LastPosition = position;
    }
}

class LooperNote
{
    constructor(beat, note)
    {
        this.Beat = beat;
        this.Note = note;
    }
}
  
  
// =================================================================
// GAME
// =================================================================

import 'phaser';
var levelsConfig;
var trackConfig;
var levelEventPosition;
var countRestarts = 0;

var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 1366,
    height: 768,
    backgroundColor: 0x0,
    physics: {
        default: 'arcade',  
        arcade: {
            gravity: { y: 0 },
            debug: false
        }      
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);

/*********Game control variables********/
var bpm = 112;
//pixels per beat
var ppb = 100;
var jumpXDistance;
var levelWidth = 1366;
var levelHeight = 768;
var punchContantPoint = [230, 470];
var kickContantPoint = [215, 520];
var jumpContantPoint = [225, 560];
var dudeConstantPointX = 0;
var startYHeightBaseForConstantPoint = 486.5;
var assetBaseRatio = 200;
/***************************************/

// Game state
var GameStateEnum = Object.freeze({"title":1, "playing":2, "gameover":3})
var GameState;

// Title screen
var titleImage;
var levelNames;

// Player data
var playerScore;
var playerLives;
var playerScoreText;
var playerLifeIndicators;
var invulnerable;
var gameOverSlowdown;

// Game entities
var beatlines = [];
var enemies = [];
var graphics;
var nextEnemy;
var dude;
var dudes = {};
var dudesNumeric;
var dudeStartingHeight = 390;
var punchCollider;
var kickCollider;

// Beat calculations
var smallestBeatInterval;
var timeElapsed;
var timeInit;
var beatCount;
var totalTimeElapsed;
var totalBeatCountElapsed;
var enemyGenerationBeatOffset;

// Keys
var punchKey;
var punchKey2;
var kickKey;
var kickKey2;
var jumpKey;
var slideKey;
var downKey;
var downKey2;
var debugKey;

// Jumping
var startX = 0;
var startY = 0;
var jumpX = 0;
var jumpY = 400;
var jumpDestinationX = 0;
var jumpDestinationY = 0;
var jumpProgressX = 0;

// Audio
var currentPaletteNum;
var currentPalette;
var context;
var bufferLoader;
var timeoutID;
var sounds;
var looperManager;
var playerDamageSoundIndex;
var loopsToStopOnEnd;

// Particle effects
var enemyDeathParticle;
var enemyEmitter;
var bigEnemyEmitter;
var collectableParticle;
var collectableEmitters = [];
var damageTakenEmitter;
var lifeLostEmitter;

// Text
var currentTextEnd;
var currentText;

//Ground and platforms
var platformGraphics;
var platforms = [];

// Background
var backgroundImage;

function preload()
{
    // Title screen
    this.load.image('title', 'assets/title.png');

    // Brian
    this.load.atlas('brians', 'assets/Briansheet.png', 'assets/Briansheet.json');
    this.load.image('kicking-dude', 'assets/Brian-Attack0002.png');
    this.load.image('punching-dude', 'assets/Brian-Attack0001.png');
    this.load.image('jumping-dude', 'assets/Brian-Jump0001.png');
    this.load.image('falling-dude', 'assets/Brian-Jump0000.png');
    this.load.image('sliding-dude', 'assets/Brian-Slide0000.png'); 

    // Enemies
    this.load.image('rat', 'assets/rat.png');
    this.load.image('honeybadger', 'assets/rat.png');
    this.load.image('bird', 'assets/bird.png');
    this.load.image('missile', 'assets/missile.png');
    
    // Buildings
    this.load.image('building1', 'assets/building 1.png');
    this.load.image('building2', 'assets/building 2.png');
    this.load.image('building3', 'assets/building 3.png');
    this.load.image('building4', 'assets/building 4.png');
    this.load.image('building5', 'assets/building 5.png');
    this.load.image('building6', 'assets/building 6.png');

    // Misc
    this.load.image('ground-block', 'assets/groundblock.png');
    this.load.image('hit-block', 'assets/hitblock.png');
    this.load.image('block', 'assets/block.png');
    this.load.image('aircon', 'assets/AirCon.png');
    this.load.image('life', 'assets/life.png');

    // Particles
    this.load.image('particle1', 'assets/particle.png');
    this.load.image('particle2', 'assets/particle2.png');
    this.load.image('particle3', 'assets/particle3.png');

    // Backgrounds
    this.load.image('background0', 'assets/Background 0.png');
    this.load.image('background1', 'assets/Background 1.png');
    this.load.image('background2', 'assets/Background 2.png');

    // Sprites
    this.load.spritesheet('gems', 'assets/gems.png', { frameWidth: 30, frameHeight: 30 });
    this.load.spritesheet('markers', 'assets/markers.png', { frameWidth: 40, frameHeight: 40 });

    // Fonts
    this.load.bitmapFont('font', 'assets/font.png', 'assets/font.fnt');
    this.load.bitmapFont('font2', 'assets/font2.png', 'assets/font2.fnt');
}

function create()
{    
    levelsConfig = require("./levels.json");
    setupTitleScreen(this);
}

function setupHitPoints(game)
{
    var punchPoint = getModifiedHitPointY(punchContantPoint[1]);
    var kickPoint = getModifiedHitPointY(kickContantPoint[1]);

    punchCollider =  game.physics.add.image(punchContantPoint[0], punchPoint, 'hit-block');
    kickCollider =  game.physics.add.image(kickContantPoint[0], kickPoint, 'hit-block');    
    punchCollider.disableBody(true, true);
    kickCollider.disableBody(true, true);
}

function getModifiedHitPointY(hitPoint)
{
  var yModifier =  startYHeightBaseForConstantPoint - hitPoint;
  return dude.y - yModifier;
}

function setupInitialGroundPlatform(game)
{
    var totalWidth = getAssetPlacement(ppb, jumpContantPoint[0]); 
    buildPlatformBlock(0, 464, totalWidth, "building1", game);
}

function buildPlatformBlock(x, y, width, buildingType, game)
{
    var platformBlock = game.physics.add.image(x, y, buildingType); 
    platformBlock.setOrigin(0,0);
    var scaleFactor = width / platformBlock.width;
    platformBlock.setScale(scaleFactor);
    //platformBlock.setDisplaySize(width, platformBlock.height * scaleFactor);
    platformBlock.setOffset(platformBlock.width / 2, platformBlock.height / 2);

    //console.log("platform start: " + platformBlock.x);
    //console.log("platform end: " + (platformBlock.x + platformBlock.width));
    //console.log("platform width: " +  platformBlock.width);

    for (var key in dudes) {
        var dude = dudes[key];
        game.physics.add.overlap(dude, platformBlock, stop);
    }

    platformBlock.depth = -50;

    platforms.push(platformBlock); 
}

function stop(dude, platformBlock)
{
    var lastY = dude.getData('last-y');  
    var bounds = platformBlock.getBounds();
    var yRelativeToPlatform = bounds.y - dude.getData('y-bounds')/2;
    if(dude.getData('going-down'))
    { 
        if(!dude.getData('platform'))
        {
            dude.setData('platform', platformBlock);
        }
    }

    if(!canJumpThroughPlatform(platformBlock))
    {  
        if(lastY < dude.y && lastY <= yRelativeToPlatform + 10) //10 gives are margin of error because update delta varies
        {   
            dude.setData('going-down', false);
            dude.setData('platform', undefined);            
            endJump(game, yRelativeToPlatform);   
        }
    }              
    return true;
}

function canJumpThroughPlatform(platformBlock)
{
    if(dude.getData('platform'))
    {        
        return platformBlock === dude.getData('platform') && !isOnLowestPlatform(platformBlock);
    }
    else
    {
        return false;
    }
}

function isOnLowestPlatform(platformBlock)
{
    for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i];
        if(platform.x + platform.width >= dude.x && platform.x <= dude.x) //pos of dude
        {
            if(platformBlock.y < platform.y)
            {
                return false;
            }
        }
    }
    return true;
}

function setupTitleScreen(game)
{
    game.input.keyboard.on('keydown', function (event) {
        if (GameState == GameStateEnum.gameover && gameOverSlowdown < 0.4)
        {
            //console.log(game);
            //console.log("length: " + game.children.list.length);
            //console.log("game.children: " + game.children.list)
            while (game.children.list.length > 0)
            {
                var child = game.children.list[0];
                //console.log("Destroying " + child);
                child.destroy();
                game.children.list.splice(0, 1);
            }
            /*
            for (var i = 0; i < game.children; i++)
            {
                var child = game.children[i];
                child.destroy();
            }
            */
            //game = new Phaser.Game(config);
            setupTitleScreen(game);
        }
    });
    
    GameState = GameStateEnum.title;
    levelNames = [];
    titleImage = game.add.image(0, 0, "title").setOrigin(0);
    titleImage.depth = 100;
    for (var i = 0; i < levelsConfig.Levels.length; i++)
    {
        var level = levelsConfig.Levels[i];
        var text = game.add.bitmapText(930, 130 + (i * 44), 'font2', level.Name);
        text.depth = 101;
        text.LevelNum = i;
        text.LevelName = level.Name;
        text.setInteractive();
        text.on('pointerover', function () {
            this.text = this.LevelName + " *";
        }); 
        text.on('pointerout', function () {
            this.text = this.LevelName;
        });
        text.on('pointerdown', function () {
            levelNames.push(titleImage);
            var tween = game.tweens.add({
                targets: levelNames,
                alpha: 0,
                duration: 1000,
                onComplete: destroyTitleScreen,
                ease: 'Cubic.easeIn'
            });
            setupLevel(this.LevelNum, game);
        });
        levelNames.push(text);
    }
}

function destroyTitleScreen(thingsToNuke)
{
    for (var i = 0; i < thingsToNuke.targets.length; i++)
    {
        var thingToNuke = thingsToNuke.targets[i];
        thingToNuke.destroy();
    }
}

function setupParticleEffects(game)
{
    enemyDeathParticle = game.add.particles('particle1');
    enemyEmitter = enemyDeathParticle.createEmitter( {
        x: 0,
        y: 0,
        angle: { min: -50, max: 30 },
        speed: { min: 0, max: 220 },
        quantity: 80,
        lifespan: 700,
        alpha: { start: 1, end: 0 },
        gravityY: 250,
        scale: { start: 0.3, end: 0.0 },
        blendMode: 'ADD',
        on: false
    });

    bigEnemyEmitter = enemyDeathParticle.createEmitter( {
        x: 0,
        y: 0,
        angle: { min: -60, max: 40 },
        speed: { min: 0, max: 340 },
        quantity: 190,
        lifespan: 900,
        alpha: { start: 1, end: 0 },
        gravityY: 250,
        scale: { start: 0.4, end: 0.0 },
        blendMode: 'ADD',
        on: false
    });

    collectableParticle = game.add.particles('particle3');
    for (var i = 1; i <= 8; i++)
    {
        var collectableEmitter = collectableParticle.createEmitter( {
            x: 0,
            y: 0,
            angle: { min: 0, max: 360 },
            speed: { min: 30, max: 340 },
            quantity: 150,
            lifespan: 1200,
            alpha: { start: 1, end: 0 },
            gravityY: 140,
            tint: findTintForCollectable(i),
            scale: { start: 0.4, end: 0.0 },
            blendMode: 'ADD',
            on: false
        });
        collectableEmitters[i] = collectableEmitter;
    }

    damageTakenEmitter = collectableParticle.createEmitter( {
        x: 0,
        y: 0,
        angle: { min: 130, max: 210 },
        speed: { min: 30, max: 250 },
        quantity: 120,
        lifespan: 1200,
        alpha: { start: 1, end: 0 },
        gravityY: 380,
        tint: 0xCC1118,
        scale: { start: 0.4, end: 0.0 },
        on: false
    });

    lifeLostEmitter = collectableParticle.createEmitter( {
        x: 0,
        y: 0,
        angle: { min: 0, max: 360 },
        speed: { min: 10, max: 130 },
        quantity: 150,
        lifespan: 1100,
        alpha: { start: 1, end: 0 },
        gravityY: 380,
        scale: { start: 0.4, end: 0.0 },
        blendMode: 'ADD',
        on: false
    });
    //console.log("Set up particles");
}

function findTintForCollectable(soundNumber)
{
    switch(soundNumber) {
        case 1:
            return 0xe6e6e6;
        case 2:
            return 0x942929;
        case 3:
            return 0xa4a121;
        case 4:
            return 0x26aa22;
        case 5:
            return 0x48daa7;
        case 6:
            return 0x46cad9;
        case 7:
            return 0x2223a7;
        case 8:
            return 0xa33fdb;
    } 
}

function continueSetup(soundList)
{
    sounds = soundList;
    //console.log("Set up " + sounds.length + " sounds.")
}

function setupLevel(levelNum, game)
{
    //console.log("SETUP LEVEL");
    countRestarts++;
    trackConfig = levelsConfig.Levels[levelNum];
    levelEventPosition = 0;
    bpm = trackConfig.Tempo;
    jumpXDistance = ppb * trackConfig.JumpMultiplier;

    playerScore = 0;
    playerLives = 7;
    invulnerable = false;

    beatlines = [];
    enemies = [];
    smallestBeatInterval = 999;
    timeElapsed = 0;
    timeInit = 0;
    beatCount = 0;
    totalTimeElapsed = 0;
    totalBeatCountElapsed = 0;
    
    startX = 0;
    startY = 0;
    jumpX = 0;
    jumpY = 400;
    jumpDestinationX = 0;
    jumpDestinationY = 0;
    jumpProgressX = 0;
    
    currentTextEnd = 0;
    currentText = null;

    //console.log("SETUP LEVEL MIDDLE");

    game.anims.create({ key: 'brianRun', frames: game.anims.generateFrameNames('brians'), repeat: -1, frameRate: 10 });    
    platformGraphics = game.add.graphics({ fillStyle: { color: 0x696969 } });

    setupBackgroundImage(game, trackConfig);

    initKeys(game);
    setupParticleEffects(game);
    graphics = game.add.graphics({ lineStyle: { width: 2, color: 0xaa0000 }, fillStyle: { color: 0x0000aa } });

    nextEnemy = trackConfig.GameEvents[0];
    findSmallestInterval();
    initDude(game);
    buildDude(166, dudeStartingHeight, 'dude', 'none', 0);
   
    dude.setData('going-down', false);
    dudeConstantPointX = dude.x;
    setupSound(trackConfig);
    debugLogLevelInfo();
    enemyGenerationBeatOffset = calculateGenerationBeatOffset();
    setupHitPoints(game);
    setupInitialGroundPlatform(game);

    playerScoreText = game.add.bitmapText(0, 10, 'font', "");
    
    playerLifeIndicators = [];
    for (var i = 0; i < playerLives; i++)
    {
        playerLifeIndicators.push(game.add.image(40 + i * 45, 30, "life"));
    }
    addPlayerScore(0);

    GameState = GameStateEnum.playing;
    
    //console.log("SETUP LEVEL END");
}

function addPlayerScore(scoreDelta)
{
    playerScore += scoreDelta;
    playerScoreText.text = playerScore;
    playerScoreText.x = 1366 - (20 + playerScoreText.width);
}

function losePlayerLife(enemy)
{
    if (invulnerable) return;

    playerLives--;
    var lostLifeIndicator = playerLifeIndicators[playerLives];

    lifeLostEmitter.setPosition(lostLifeIndicator.x, lostLifeIndicator.y);
    lifeLostEmitter.explode();

    var yPos;
    if (enemy != null)
        yPos = enemy.y;
    else
        yPos = dude.y;
    damageTakenEmitter.setPosition(dude.x, yPos);
    damageTakenEmitter.explode();

    playSoundFromLooper(playerDamageSoundIndex);

    var tween = lostLifeIndicator.scene.tweens.add({
        targets: lostLifeIndicator,
        alpha: 0,
        duration: 500,
        onComplete: destroyBody
    });

    invulnerable = true;

    if (playerLives == 0)
    {
        poorBrianIsDeceasedRIPBrian("GAME OVER");
        return;
    }

    dude.tint = 0xBB5555;
    dude.alpha = 0.8;

    tween = dude.scene.tweens.add({
        targets: dudesNumeric,
        alpha: 0.4,
        tint: 0x882222,
        duration: 500,
        repeat: 2,
        yoyo: true,
        onComplete: invulnerabilityExpired
    });
}

function poorBrianIsDeceasedRIPBrian(endMessage)
{
    GameState = GameStateEnum.gameover;
    for (var i = 0; i < loopsToStopOnEnd.length; i++)
    {
        var sound = loopsToStopOnEnd[i];
        sound.stop();        
    }
    gameOverSlowdown = 1.0;
    buildDude(dude.x, dude.y, 'sliding-dude', 'slide', 1000000);
    if (currentText != null) fadeOutText(dude.scene);
    CreateText(dude.scene, endMessage, 4, 375);
}

function invulnerabilityExpired()
{
    for (var i = 0; i < this.targets.length; i++)
    {
        var target = this.targets[i];
        target.alpha = 1;
        target.tint = 0xFFFFFF;
        //console.log(target);
    }
    
    invulnerable = false;
}

function calculateGenerationBeatOffset()
{
    var offSetX = 0;
    var beatOffset = 0;
    while(offSetX <= levelWidth)
    {
        beatOffset++;
        offSetX += ppb;
    }
    return beatOffset;
}

function setupBackgroundImage(game, trackConfig)
{
    backgroundImage = game.add.image(0, 0, trackConfig.Background).setOrigin(0);
    backgroundImage.depth = -100;
}

function setupSound(trackConfig)
{
    loopsToStopOnEnd = [];
    SetupPalette(trackConfig, 1);
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
    
    var soundArray = trackConfig.SampleList.slice(0);
    playerDamageSoundIndex = soundArray.length;
    soundArray.push("Sound/Dissonant.wav");

    bufferLoader = new BufferLoader(
        context,
        soundArray,     // trackConfig.SampleList
        continueSetup
        );
    
    bufferLoader.load();

    looperManager = new LooperManager();
}

function SetupPalette(trackConfig, trackNumber)
{
    currentPaletteNum = trackNumber;
    currentPalette = [];
    var trackInfo = trackConfig.TrackInfos[trackNumber - 1];
    for (var i = 0; i < trackInfo.SampleMaps.length; i++)
    {
        var sampleMap = trackInfo.SampleMaps[i];
        //currentPalette[sampleMap.SourceActionIndex] = sampleMap.SampleFileIndex;
        currentPalette[sampleMap.SourceActionIndex] = sampleMap;
    }
}

function debugLogLevelInfo()
{
    //console.log("BPM: " + bpm);
    //console.log("Smallest interval: " + smallestBeatInterval);
}

function initKeys(game)
{    
    punchKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    punchKey2 = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    kickKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    kickKey2 = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    jumpKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    slideKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    downKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    downKey2 = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    debugKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
}

function initDude(game)
{    
    var colX = 40;
    var colY = 155;
    dudes['dude'] = game.physics.add.sprite(166, dudeStartingHeight, 'brians');
    dudes['dude'].play('brianRun');
    dudes['dude'].setSize(colX, colY, true);
    dudes['dude'].width = colX;
    dudes['dude'].setData('y-bounds', colY);
    dudes['dude'].disableBody(true, true);
    dudes['kicking-dude'] = game.physics.add.image(166, dudeStartingHeight, 'kicking-dude');
    dudes['kicking-dude'].disableBody(true, true);
    dudes['kicking-dude'].setSize(colX, colY, true);
    dudes['kicking-dude'].width = colX;
    dudes['kicking-dude'].setData('y-bounds', colY);
    dudes['punching-dude'] = game.physics.add.image(166, dudeStartingHeight, 'punching-dude');
    dudes['punching-dude'].disableBody(true, true);
    dudes['punching-dude'].setSize(colX, colY, true);
    dudes['punching-dude'].width = colX;
    dudes['punching-dude'].setData('y-bounds', colY);
    dudes['jumping-dude'] = game.physics.add.image(166, dudeStartingHeight, 'jumping-dude');
    dudes['jumping-dude'].disableBody(true, true);
    dudes['jumping-dude'].setSize(colX, colY, true);
    dudes['jumping-dude'].width = colX;
    dudes['jumping-dude'].setData('y-bounds', colY);
    dudes['falling-dude'] = game.physics.add.image(166, dudeStartingHeight, 'falling-dude');
    dudes['falling-dude'].setSize(colX, colY, true);
    dudes['falling-dude'].disableBody(true, true);
    dudes['falling-dude'].width = colX;
    dudes['falling-dude'].setData('y-bounds', colY);
    dudes['sliding-dude'] = game.physics.add.image(166, dudeStartingHeight, 'sliding-dude');
    dudes['sliding-dude'].disableBody(true, true);
    dudes['sliding-dude'].setSize(colX, colY, true);
    dudes['sliding-dude'].width = colX;
    dudes['sliding-dude'].setData('y-bounds', colY);

    dudesNumeric = [];
    dudesNumeric.push(dudes['dude']);
    dudesNumeric.push(dudes['kicking-dude']);
    dudesNumeric.push(dudes['punching-dude']);
    dudesNumeric.push(dudes['jumping-dude']);
    dudesNumeric.push(dudes['sliding-dude']);
    // dudes['jump-kick-dude'] = game.physics.add.image(166, 499, 'jump-kick-dude');
    // dudes['jump-kick-dude'].disableBody(true, true);
}

function buildDude(x, y, dudeInstance, action, actionInitiated)
{   
    var yData = dudeStartingHeight;
    if (dude)
    {      
        yData = dude.getData('last-y') === undefined ? dudeStartingHeight : dude.getData('last-y');
        if (dude != null && dude.body != null)
            dude.disableBody(true, true);
    } 
    dude = dudes[dudeInstance];    
    dude.x = x;
    dude.y = y;
    dude.enableBody(false, x, y, true, true);           // Maybe first param true?
    setDude(dude, action, actionInitiated, yData);
}

function findSmallestInterval()
{   
    /* 
    for (var i = 0; i < trackConfig.GameEvents.length - 1; i++) {
        const enemy = trackConfig.GameEvents[i];
        const nextEnemy = trackConfig.GameEvents[i+1];  
        if(nextEnemy.TimeStamp !== enemy.TimeStamp)
        {
            var entryDelta = nextEnemy.TimeStamp - enemy.TimeStamp;
            if(entryDelta < smallestBeatInterval && entryDelta != 0)
            {
                smallestBeatInterval = entryDelta;
            }
        }
    }
    */
   smallestBeatInterval = 0.25;
}

function setDude(dude, action, actionInitiated, yData)
{   
    dude.setData('last-y', yData);
    dude.setData('action', action);
    dude.setData('action-initiated', actionInitiated);
}

function update(time, delta)
{
    //if (GameState == GameStateEnum.playing)
        //console.log("pos: " + levelEventPosition + " / time: " + time + " / delta: " + delta);

    if (GameState == GameStateEnum.gameover && gameOverSlowdown > 0)
        gameOverSlowdown -= 0.01;

    if (GameState == GameStateEnum.playing)
    {
        dude.setData('last-y', dude.y);
        processKey(time, this);
    }

    if (GameState != GameStateEnum.title)
    {
        calculateBeatsElapsed(time, delta, this);
        //updateBeatLines(delta);
        updateEnemies(delta);
        updatePlatforms(delta);    
    }

    if (GameState == GameStateEnum.playing)
        updateDude(time, this, delta);
}

function updateDude(time, game, delta)
{    
    var moveAmount = getMove(delta, ppb);
    if(dude.getData('action') === 'punch' || dude.getData('action') === 'kick' || dude.getData('action') === 'returning')
    {
        processAttack(time, game);
    }
    else if (dude.getData('action') === 'jump' || dude.getData('action') === 'jumping' || dude.getData('action') === 'jump-kick')
    {
        processJump(moveAmount, game);
    }
    else if (dude.getData('action') === 'slide')
    {
        processSlide(time, game);
    }
    else if (dude.getData('action') === 'none' && running || dude.getData('action') === 'falling' || dude.getData('action') === 'fall')
    {
        processFall(moveAmount, game);
    }
}

function processSlide(time, game)
{
    var actionInitiated = dude.getData('action-initiated');
    var delta = time - actionInitiated;    
    var bpms = (60 / bpm) * 1000;

    if (delta >= bpms)
    {
        buildDude(dude.x, dude.y, 'dude', 'none', 0);
    }
}

function processFall(moveAmount, game)
{
    if (dude.getData('action') === 'none' || dude.getData('action') === 'fall')    
    {
        initFall();         
    }
    
    dude.y = getCurrentJumpHeight(moveAmount);
    if (dude.y - (dude.height / 2) > levelHeight)
    {
        ProcessPlayerDrop();
    }
}

function initFall()
{        
    jumpX = dude.x + (ppb/2);
    jumpY = dude.y;

    startX = jumpX + 0.1;
    startY = jumpY;
    
    jumpDestinationX = dude.x + ppb;
    jumpDestinationY = dude.y + 100;

    jumpProgressX = startX;    
    dude.setData('action', 'falling');
}

function processJump(moveAmount, game)
{
    if(dude.getData('action') !== 'jumping' && dude.getData('action') !== 'jump-kick')    
    {
        initJump(); 
    }
    
    dude.y = getCurrentJumpHeight(moveAmount);
    if(jumpProgressX > jumpX)
    {
      buildDude(dude.x, dude.y, 'falling-dude', 'jumping', 0);
    }

    if(dude.y > levelHeight)
    {
        ProcessPlayerDrop();
    }
}

function getCurrentJumpHeight(moveAmount)
{
    jumpProgressX += moveAmount;
    var a1 = -(startX * startX) + (jumpX * jumpX);
    var b1 = -startX + jumpX;
    var d1 = -startY + jumpY;

    var a2 = -(jumpX * jumpX) + (jumpDestinationX * jumpDestinationX);
    var b2 = -jumpX + jumpDestinationX;
    var d2 = -jumpY + jumpDestinationY; 

    var bMultiplier = -(b2/b1);

    var a3 = bMultiplier * a1 + a2;

    var d3 = bMultiplier * d1 + d2;

    var a = d3/a3;
    var b = (d1-a1 * a)/b1;
    var c = startY - (a*(startX * startX)) - (b * startX);

    return (a * (jumpProgressX * jumpProgressX)) + (b * jumpProgressX) + c;
}

function initJump()
{
    startX = dude.x;
    startY = dude.y;
    
    jumpX = startX + (ppb/2);
    jumpY = dude.y - 100;
    
    jumpDestinationX = startX + jumpXDistance;
    jumpDestinationY = startY;

    jumpProgressX = startX;
    dude.setData('action', 'jumping');
}

function endJump(game, y)
{
  if(dude.getData('action') === 'jumping')
  {
    ProcessLand();
  }

    startX = 0;
    startY = 0;

    jumpX = 0;
    jumpY = 700;

    jumpDestinationX = 0;
    jumpDestinationY = 0;
    
    buildDude(dude.x, y, 'dude', 'none', 0);
}

function processAttack(time, game)
{   
    if(dude.getData('action') === 'punch')
    {
        punchCollider.enableBody(true, punchContantPoint[0], getModifiedHitPointY(punchContantPoint[1]), true, false);
    }
    else if(dude.getData('action') === 'kick')
    {
        kickCollider.enableBody(true, kickContantPoint[0], getModifiedHitPointY(kickContantPoint[1]), true, false);
    }
    var delta = time - dude.getData('action-initiated');
    var beatDuration = (60 / bpm);

    var smallestInterval = beatDuration * smallestBeatInterval;

    if((delta) >= ((smallestInterval * 1000)) && dude.getData('action') !== 'returning')
    {
        punchCollider.disableBody(true, true);
        kickCollider.disableBody(true, true);
        var actionInitiated = dude.getData('action-initiated'); 
        buildDude(dude.x, dude.y, 'dude', 'returning', actionInitiated);
    } 
    else if(delta >= (smallestInterval * 1000))
    {
        punchCollider.disableBody(true, true);
        kickCollider.disableBody(true, true);
        setDude(dude,'none', 0);
    }
}

function processKey(time, game)
{
    if(dude.getData('action') === 'none')
    {
        if (Phaser.Input.Keyboard.JustDown(punchKey) || Phaser.Input.Keyboard.JustDown(punchKey2))
        {
            ProcessPunch(time);
        }
        else if (Phaser.Input.Keyboard.JustDown(kickKey) || Phaser.Input.Keyboard.JustDown(kickKey2))
        {
            ProcessKick(time);
        }
        else if (Phaser.Input.Keyboard.JustDown(jumpKey))
        {
            ProcessJump(time);
        }
        else if (Phaser.Input.Keyboard.JustDown(slideKey))
        { 
            ProcessSlide(time);
        }
        else if (Phaser.Input.Keyboard.JustDown(downKey) || Phaser.Input.Keyboard.JustDown(downKey2))
        { 
            ProcessDrop(time);
        }
        else if (Phaser.Input.Keyboard.JustDown(debugKey))
        { 
            ProcessDebug(time);
        }
    } 
    else if(dude.getData('action') === 'jumping')
    {
        if (Phaser.Input.Keyboard.JustDown(kickKey))
        {
            ProcessJumpKick(time);
        }
    }
}

function ProcessDrop(time)
{
    buildDude(dude.x, dude.y, 'falling-dude', 'fall', time);
    dude.setData('going-down', true);
}

function ProcessPunch(time)
{
    buildDude(dude.x, dude.y, 'punching-dude', 'punch', time);
}

function ProcessKick(time)
{
    buildDude(dude.x, dude.y, 'kicking-dude', 'kick', time);
}

function ProcessJump(time)
{
    buildDude(dude.x, dude.y, 'jumping-dude', 'jump', time);
    playSound(3, null);
}

function ProcessJumpKick(time)
{
    // Disabled jump kick for now, for simplicity
    //buildDude(dude.x, dude.y, 'jump-kick-dude', 'jump-kick', time);
}

function ProcessLand(time)
{
    playSound(4, null);
}

function ProcessSlide(time)
{
    buildDude(dude.x, dude.y, 'sliding-dude', 'slide', time);
    playSound(5, null);
}

function ProcessSlideEnd(time)
{
}

function ProcessDebug()
{
    //console.log("smallestBeatInterval: " + smallestBeatInterval);
    console.log("timeElapsed: " + timeElapsed);
    console.log("timeInit: " + timeInit);
    console.log("beatCount: " + beatCount);
}

function calculateBeatsElapsed(time, delta, game)
{
    /*
    if (timeInit === 0)
    {
        timeInit = time;
        timeElapsed = time;
    }
    */
    timeElapsed += delta;

    var bDuration = (60/bpm) * 1000
    
    totalTimeElapsed = (beatCount * bDuration) + timeElapsed;
    totalBeatCountElapsed = beatCount + (timeElapsed / bDuration);

    if (GameState == GameStateEnum.gameover)
        return;

    if (totalBeatCountElapsed > trackConfig.LevelEnd)
    {
        addPlayerScore(1000 * playerLives);
        poorBrianIsDeceasedRIPBrian("LEVEL COMPLETE");
    }

    backgroundImage.x = -((backgroundImage.width - 1366) * (totalBeatCountElapsed / trackConfig.LevelEnd));

    looperManager.ProcessTick(totalBeatCountElapsed);

    generateDueAssets(game, bDuration);
    /*
    if (totalTimeElapsed >= (nextEnemy.TimeStamp * bDuration))
    {       
        generateAsset(game);                   
    }
    */
    
    if (timeElapsed >= bDuration)
    {
        timeElapsed -= bDuration;
        running = true;
        //timeElapsed = 0;
        beatElapsed(game);
    }
}

function beatElapsed(game)
{
    beatCount++;
    if (currentText != null && currentTextEnd <= beatCount)
    {
        fadeOutText(game);
    }
    generateBeatLine(); 
}

function fadeOutText(game)
{
    var tween = game.tweens.add({
        targets: currentText,
        y: 48,
        alpha: 0,
        duration: 1000,
        onComplete: destroyBody,
        ease: 'Cubic.easeIn'
    });
    currentText = null;
}

function generateDueAssets(game, bDuration)
{
    //if (countRestarts > 1)
        //debugger;

    var count = 0;
    while (levelEventPosition < trackConfig.GameEvents.length && totalTimeElapsed >= (trackConfig.GameEvents[levelEventPosition].TimeStamp * bDuration))
    {
        generateDueAsset(trackConfig.GameEvents[levelEventPosition], game);
        levelEventPosition++;
        count++;
    }

    //console.log("bDuration: " + bDuration + " / Generated assets: " + count);
}

function generateDueAsset(asset, game)
{
    if(asset.Type === "platform")
    {
        buildPlatform(asset, game);
    }
    else
    {
        buildEnemy(asset, game);
    }
}

/*
function generateAsset(game)
{
    var i;
    for (i = levelEventPosition; i < trackConfig.GameEvents.length; i++) {
        console.log("LOOP" + i);
        const enemy = trackConfig.GameEvents[i];
        if(enemy.TimeStamp === nextEnemy.TimeStamp)
        {
            if(enemy.Type === "platform")
            {
                buildPlatform(enemy, game);
            }
            else
            {
                buildEnemy(enemy, game);
            }
            levelEventPosition++;
        }
        else
        {
            break;
        }
    }

    if (levelEventPosition < trackConfig.GameEvents.length)
        nextEnemy = trackConfig.GameEvents[levelEventPosition];

//    trackConfig.GameEvents.splice(0, i);
//    if(trackConfig.GameEvents.length > 0)
//    {
//        nextEnemy = trackConfig.GameEvents[0];
//    }
}
*/

function buildPlatform(platformConfig, game)
{
    var y = platformConfig.YPos;
    var width = platformConfig.Width * ppb + 25;
    var buildingType = "building" + platformConfig.SubType;
    var x = getAssetPlacement(ppb, jumpContantPoint[0]);

    buildPlatformBlock(x, y, width, buildingType, game);
}

function getAssetPlacement(speed, meetingPoint)
{
    return speed * enemyGenerationBeatOffset + meetingPoint;
}

function buildEnemy(enemyConfig, game)
{
    var speed = ppb;
    var y = 0;
    var graphic = "";
    var frame = -1;
    var contactPoint = dudeConstantPointX; // change these when resizing enemy hit boxes ********
    var special = 0;
    var resizeRatio = 1;
    debugger;
    if (enemyConfig.Type === "enemy")
    {
        if (enemyConfig.SubType == "rat")
        {
            y = 535;
            graphic = "rat";
            speed = ppb + 100;
            contactPoint = kickContantPoint[0]; // change these when resizing enemy hit boxes ********
            special = 1;
        }
        if (enemyConfig.SubType == "honeybadger")
        {
            y = 535;
            graphic = "honeybadger";
            speed = ppb + 150;
            contactPoint = kickContantPoint[0]; // change these when resizing enemy hit boxes ********
            special = 1;
        }
        else if (enemyConfig.SubType == "bird")
        {
            y = 450;
            graphic = "bird";
            speed = ppb + 200;
            contactPoint = punchContantPoint[0]; // change these when resizing enemy hit boxes ********
            special = 2;
        }
        else if (enemyConfig.SubType == "missile")
        {
            y = -100;
            graphic = "missile";
            speed = ppb + 300;
            contactPoint = punchContantPoint[0]; // change these when resizing enemy hit boxes ********
            special = 3;
            resizeRatio = ppb  / assetBaseRatio;
        }
    }
    else if (enemyConfig.Type === "gem")
    {
        y = enemyConfig.YPos;
        graphic = "gems";
        frame = Number(enemyConfig.SubType);
        contactPoint = dudeConstantPointX; // change these when resizing enemy hit boxes ********
    }
    else if (enemyConfig.Type === "block")
    {
        contactPoint = jumpContantPoint[0]; // change these when resizing enemy hit boxes ********
        y = 435;
        graphic = "block";
        resizeRatio = ppb  / assetBaseRatio;
    }
    else if (enemyConfig.Type === "aircon")
    {
        contactPoint = jumpContantPoint[0]; // change these when resizing enemy hit boxes ********
        y = 536;
        graphic = "aircon";
        special = 4;
        resizeRatio = ppb  / assetBaseRatio;
    }
    else if (enemyConfig.Type === "LoopRecordStart")
    {
        y = 30;
        graphic = "markers";
        frame = 23 + Number(enemyConfig.SubType);
    }
    else if (enemyConfig.Type === "LoopRecordStop")
    {
        y = 30;
        graphic = "markers";
        frame = 15 + Number(enemyConfig.SubType);
    }
    else if (enemyConfig.Type === "LoopPlayStart")
    {
        y = 55;
        graphic = "markers";
        frame = 7 + Number(enemyConfig.SubType);
    }
    else if (enemyConfig.Type === "LoopPlayStop")
    {
        y = 30;
        graphic = "markers";
        frame = 15 + Number(enemyConfig.SubType);
    }
    else if (enemyConfig.Type === "LoopClear")
    {
        y = 30;
        graphic = "markers";
        frame = 15 + Number(enemyConfig.SubType);
    }
    else if (enemyConfig.Type === "Palette")
    {
        y = 30;
        graphic = "markers";
        frame = Number(enemyConfig.SubType) - 1;
    }
    else if (enemyConfig.Type === "Text")
    {
        CreateText(game, enemyConfig.SubType, enemyConfig.Width);
    }

    if (graphic == "") return;

    var x = getAssetPlacement(speed, contactPoint);
    var enemy = game.physics.add.image(x, y, graphic);
    enemy.x += enemy.width/2; 
    enemy.setScale(resizeRatio);
    debugger;
    var yAdjustment = getYAdjustment(enemy, resizeRatio);
    enemy.y += yAdjustment; 
    if (frame > -1)
        enemy.setFrame(frame);
    enemy.setData('enemy-data', enemyConfig);
    enemy.setData('enemy-speed', speed);

    if (special == 1)
    {
        game.tweens.add({
            targets: enemy,
            duration: 35,
            y: y + 3,
            repeat: -1,
            yoyo: true
        });
    }
    else if (special == 2)
    {
        game.tweens.add({
            targets: enemy,
            duration: 350,
            y: y + 24,
            repeat: -1,
            ease: 'Sine.easeInOut',
            yoyo: true
        });
    }
    else if (special == 3)
    {
        game.tweens.add({
            targets: enemy,
            duration: 3600,
            ease: 'Sine.easeInOut',
            y: 450,
        });

        var missileEmitter = collectableParticle.createEmitter( {
            x: 20,
            y: { min: -5, max: 5 },
            angle: { min: 85, max: 95 },
            speed: { min: 0, max: 130 },
            quantity: 10,
            lifespan: 200,
            alpha: { start: 1, end: 0 },
            gravityY: 250,
            scale: { start: 0.2, end: 0.0 },
            blendMode: 'ADD',
            on: true
        });

        enemy.missileEmitter = missileEmitter;
        missileEmitter.startFollow(enemy);
    }
    else if (special == 4)
    {
        enemy.setSize(50, 50, false);        
    }
    enemies.push(enemy);
    addEnemyCollisions(game, enemy);
}

function getYAdjustment(enemy, resizeRatio)
{
    return (enemy.height - (enemy.height * resizeRatio)) / 2;
}

function CreateText(game, textString, width, y)
{
    if (y == null) y = 70;
    currentTextEnd = beatCount + width;
    currentText = game.add.bitmapText(0, y + 23, 'font', textString);
    currentText.x = (1366 - currentText.width) / 2;
    currentText.alpha = 0;
    var tween = game.tweens.add({
        targets: currentText,
        y: y,
        alpha: 1,
        duration: 1700,
        ease: 'Cubic.easeOut'
    });
}

function addEnemyCollisions(game, enemy)
{
    for (var key in dudes) {
        var dude = dudes[key];
        game.physics.add.overlap(dude, enemy, playerEnemyCollide);
    }
    var enemyConfig = enemy.getData('enemy-data');

    if (enemyConfig.SubType === "rat")
    {
        game.physics.add.overlap(kickCollider, enemy, playerRatAttack);
    }
    else if (enemyConfig.SubType === "honeybadger")
    {
        game.physics.add.overlap(kickCollider, enemy, playerHoneybadgerAttack);
    }
    else if (enemyConfig.SubType === "bird")
    {
        game.physics.add.overlap(punchCollider, enemy, playerBirdAttack);
    }
    else if (enemyConfig.SubType === "missile")
    {
        game.physics.add.overlap(punchCollider, enemy, playerMissileAttack);
    }
}

function playerRatAttack(dude, enemy)
{
  ProcessGroundEnemyKilled(enemy, 21)
}

function playerHoneybadgerAttack(dude, enemy)
{
  ProcessGroundEnemyKilled(enemy, 22)
}

function playerBirdAttack(dude, enemy)
{
    ProcessAirEnemyKilled(enemy, 23);
}

function playerMissileAttack(dude, enemy)
{
    ProcessMissileEnemyKilled(enemy, 24);
}

function playerEnemyCollide(dude, enemy)
{
     if (enemy.getData('enemy-data').Type === 'gem')
    {
        ProcessCollectableCollected(enemy);
    }
    else if (enemy.getData('enemy-data').Type === "block")
    {
        //console.log(dude.getData('action'));
        if (dude.getData('action') != 'slide')
            ProcessPlayerCollision(enemy);
    }
    else
    {
        ProcessPlayerCollision(enemy);
    }
}

function ProcessPlayerCollision(enemy)
{
    losePlayerLife(enemy);
}

function ProcessPlayerDrop()
{
    losePlayerLife();
    placeDudeBackOnPlatform();
}

function placeDudeBackOnPlatform()
{
  for (let i = 0; i < platforms.length; i++) {
    const platform = platforms[i];
    if(platform.x + platform.width >= dude.x)
    {
      buildDude(dude.x, platform.y - dude.height / 2, 'dude', 'none', 0);      
    }
  }
}

function ProcessAirEnemyKilled(enemy, enemySoundNum)
{
    playSound(2, null);
    playSound(enemySoundNum, null);

    enemy.disableBody(true, false);

    enemyEmitter.setPosition(enemy.x, enemy.y);
    enemyEmitter.explode();

    var xDest = enemy.x + (50 + Math.random() * 40.0);
    var yDest = enemy.y + (-60 + (Math.random() * 120.0));
    var duration = 350 + (Math.random() * 150.0);

    var tween = enemy.scene.tweens.add({
        targets: enemy,
        x: xDest,
        y: yDest,
        alpha: 0,
        duration: duration,
        onComplete: destroyBody,
        ease: 'Cubic.easeOut'
    });

    addPlayerScore(200);
}

function ProcessGroundEnemyKilled(enemy, enemySoundNum)
{
    playSound(1, null);
    playSound(enemySoundNum, null);

    enemy.disableBody(true, false);

    enemyEmitter.setPosition(enemy.x, enemy.y);
    enemyEmitter.explode();

    var xDest = enemy.x + (50 + Math.random() * 40.0);
    var yDest = enemy.y - (10 + (Math.random() * 70.0));
    var duration = 350 + (Math.random() * 150.0);

    var tween = enemy.scene.tweens.add({
        targets: enemy,
        x: xDest,
        y: yDest,
        alpha: 0,
        duration: duration,
        onComplete: destroyBody,
        ease: 'Cubic.easeOut'
    });

    addPlayerScore(200);
}


function ProcessMissileEnemyKilled(enemy, enemySoundNum)
{
    playSound(2, null);
    playSound(enemySoundNum, null);

    enemy.disableBody(true, false);

    bigEnemyEmitter.setPosition(enemy.x, enemy.y);
    bigEnemyEmitter.explode();

    var xDest = enemy.x + (50 + Math.random() * 40.0);
    var yDest = enemy.y + (-60 + (Math.random() * 120.0));
    var duration = 350 + (Math.random() * 150.0);

    var tween = enemy.scene.tweens.add({
        targets: enemy,
        x: xDest,
        y: yDest,
        alpha: 0,
        duration: duration,
        onComplete: destroyBody,
        ease: 'Cubic.easeOut'
    });

    //console.log(enemy.missileEmitter);
    if (enemy.missileEmitter != null)
        enemy.missileEmitter.stop();

    addPlayerScore(200);
}

function ProcessCollectableCollected(enemy)
{
    var gemType = Number(enemy.getData('enemy-data').SubType) + 1;
    var soundNumber = gemType + 8;
    playSound(soundNumber, null);

    enemy.disableBody(true, false);

    collectableEmitters[gemType].setPosition(enemy.x, enemy.y);
    collectableEmitters[gemType].explode();

    var duration = 650 + (Math.random() * 250.0);

    var tween = enemy.scene.tweens.add({
        targets: enemy,
        alpha: 0,
        scaleX: 2,
        scaleY: 2,
        duration: duration,
        onComplete: destroyBody,
        ease: 'Cubic.easeOut'
    });

    addPlayerScore(gemType * 50);
}

function destroyBody(tween)
{
    tween.targets[0].destroy();
}

function generateBeatLine()
{
    var line = new Phaser.Geom.Rectangle();
    line.width = 2;
    line.height = 768;
    line.x = levelWidth;
    line.y = 0;
    beatlines.push(line);
}

var running = false;
function updatePlatforms(delta)
{
    if(running)
    {    
        for (let i = 0; i < platforms.length; i++) {
            var platform = platforms[i];        
            if(platform.x + platform.width * 4 <= 0)
            {
                platform.destroy();
                platform = null;
                platforms.splice(i, 1);
            }
            else
            {
                var moveAmount = getMove(delta, ppb);
                platform.x -= moveAmount;           
            }
        }
    }
}

function updateBeatLines(delta)
{
    var moveAmount = getMove(delta, ppb);
    graphics.clear();
    for (let i = beatlines.length - 1; i >= 0; i--) {
        var line = beatlines[i];
        if(line.x < 0)
        {
            line.setEmpty();
            beatlines.splice(i,1);
        }
        else
        {        
            line.x -= moveAmount;  
            graphics.fillRectShape(line);      
        }
    }
}

function updateEnemies(delta)
{
    for (let i = enemies.length - 1; i >= 0; i--) {
        var enemy = enemies[i];
        if (!enemy.isDead)
        {
            if(enemy.x < -(enemy.width / 2))
            {
                enemy.destroy();
                enemy = null;
                enemies.splice(i,1);
            }
            else
            {
                var moveAmount = getMove(delta, enemy.getData('enemy-speed'));
                enemy.x -= moveAmount;
                if (enemy.x <= dude.x)
                {
                    ProcessMarkerReached(enemy, totalBeatCountElapsed);
                }
            }
        }
    }
}

function ProcessMarkerReached(enemy, currentBeat)
{
    var enemyData = enemy.getData('enemy-data');
    if (enemyData == null)
        return;

    if (enemyData.Type == "LoopRecordStart")
    {
        var paletteNum = Number(enemyData.SubType);
        looperManager.StartRecording(paletteNum, currentBeat, enemyData.Width);
    }
    else if (enemyData.Type == "LoopRecordStop")
    {
        var paletteNum = Number(enemyData.SubType);
        looperManager.Stop(paletteNum);
    }
    else if (enemyData.Type == "LoopPlayStart")
    {
        var paletteNum = Number(enemyData.SubType);
        looperManager.StartPlayback(paletteNum, currentBeat);
    }
    else if (enemyData.Type == "LoopPlayStop")
    {
        var paletteNum = Number(enemyData.SubType);
        looperManager.Stop(paletteNum);
    }
    else if (enemyData.Type == "LoopClear")
    {
        var paletteNum = Number(enemyData.SubType);
        looperManager.Clear(paletteNum);
    }
    else if (enemyData.Type == "Palette")
    {
        var paletteNum = Number(enemyData.SubType);
        SetupPalette(trackConfig, paletteNum);
    }
    else
    {
        return;
    }

    var tween = enemy.scene.tweens.add({
        targets: enemy,
        scaleX: 2.5,
        scaleY: 2.5,
        alpha: 0,
        duration: 1500,
        onComplete: destroyBody,
        ease: 'Cubic.easeIn'
    });

    enemy.isDead = true;
}

function getMove(delta, speed)
{
    //Beats per second
    var beatDuration = (60 / bpm);
    //beats per millisecond delta percent
    var bpmsDelta =   delta / (beatDuration * 1000);
    //pixels per beat delta
    var bbpDelta = speed * bpmsDelta;

    if (GameState == GameStateEnum.gameover)
    {
        bbpDelta *= gameOverSlowdown;
    }

    return bbpDelta
}

function playSound(soundNum, time)
{
    if (sounds == null)
        return;

    var soundItem = currentPalette[soundNum];
    if(soundItem !== null && soundItem !== undefined)
    {        
        var soundIndex = soundItem.SampleFileIndex;
        var source = context.createBufferSource();
        source.buffer = sounds[soundIndex];
        source.connect(context.destination);
        if (soundItem.LoopStart != null && soundItem.LoopStart > 0)
        {
            source.loop = true;
            source.loopStart = soundItem.LoopStart;
            source.loopEnd = soundItem.LoopEnd;
            //console.log("LOOP: " + source.loop);
            //console.log("LOOP START: " + source.loopStart);
            //console.log("LOOP END: " + source.loopEnd);
            loopsToStopOnEnd.push(source);
        }
        source.start(time);
        if (!soundItem.ExcludeFromLooping)
            looperManager.SoundPlayed(totalBeatCountElapsed, currentPaletteNum, soundIndex);
    }
}

function playSoundFromLooper(soundNum)
{
    var source = context.createBufferSource();
    source.buffer = sounds[soundNum];
    source.connect(context.destination);
    source.start(null);
}


  
// =================================================================
// AUDIO BUFFER LOADER
// =================================================================

function BufferLoader(context, urlList, callback) {
    this.context = context;
    this.urlList = urlList;
    this.onload = callback;
    this.bufferList = new Array();
    this.loadCount = 0;
  }
  
  BufferLoader.prototype.loadBuffer = function(url, index) {
    // Load buffer asynchronously
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
  
    var loader = this;
  
    request.onload = function() {
      // Asynchronously decode the audio file data in request.response
      loader.context.decodeAudioData(
        request.response,
        function(buffer) {
          if (!buffer) {
            alert('error decoding file data: ' + url);
            return;
          }
          loader.bufferList[index] = buffer;
          //console.log("loadCount: " + loader.loadCount);
          if (++loader.loadCount == loader.urlList.length)
            loader.onload(loader.bufferList);
        },
        function(error) {
          console.error('decodeAudioData error', error);
        }
      );
    }
  
    request.onerror = function() {
      alert('BufferLoader: XHR error');
    }
  
    request.send();
  }
  
  BufferLoader.prototype.load = function() {
    for (var i = 0; i < this.urlList.length; ++i)
    {
        //console.log(this.urlList[i]);
        this.loadBuffer(this.urlList[i], i);
    }
  }
