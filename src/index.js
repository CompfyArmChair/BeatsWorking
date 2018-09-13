  
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
        console.log("Start recording: " + channel);
        if (this.Loopers[channel] == null)
        {
            this.Loopers[channel] = new Looper(loopLength);
        }
        this.Loopers[channel].StartRecording(currentBeat - SequencePreCue);
    }

    StartPlayback(channel, currentBeat)
    {
        console.log("Start playback: " + channel);
        if (this.Loopers[channel] == null)
        {
            this.Loopers[channel] = new Looper();
        }
        this.Loopers[channel].StartPlayback(currentBeat);
    }

    Stop(channel)
    {
        this.Loopers[channel].Stop();
    }

    Mute(channel)
    {
        this.Loopers[channel].Mute();
    }

    Unmute(channel)
    {
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
        this.QuantiseStrength = 0;
        this.QuantiseResolution = 0.25;
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
        console.log ("SEQUENCE");
        for (var i = 0; i < this.Events.length; i++)
        {
            var ev = this.Events[i];
            console.log (i + ": " + ev.Beat + " - " + ev.Note);
        }
    }

    Stop()
    {
        this.State = LoopState.stopped;
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

var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 1366,
    height: 768,
    backgroundColor: 0x0,
    physics: {
        default: 'arcade',  
        arcade: {
            gravity: { y: 0 }
        }      
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);
var storeThis;

/*********Game control variables********/
var bpm = 112;
//pixels per beat
var ppb = 200;
/***************************************/

// Game state
var GameStateEnum = Object.freeze({"title":1, "playing":2, "gameover":3})
var GameState = GameStateEnum.title;

// Title screen
var titleImage;
var levelNames;

// Game entities
var beatlines = [];
var enemies = [];
var graphics;
var nextEnemyEntry;
var dude;
var dudes = {};

// Beat calculations
var smallestBeatInterval = 999;
var timeElapsed = 0;
var timeInit = 0;
var beatCount = 0;        // 168 = gems
var totalTimeElapsed;
var totalBeatCountElapsed;

// Keys
var punchKey;
var kickKey;
var jumpKey;
var slideKey;
var downKey;
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

// Particle effects
var enemyDeathParticle;
var enemyEmitter;
var collectableParticle;
var collectableEmitters = [];

// Text
var currentTextEnd;
var currentText;

// Background
var backgroundImage;


function preload()
{
    // Title screen
    this.load.image('title', 'assets/title.png');

    // Enemies
    this.load.image('rat', 'assets/rat.png');
    this.load.image('bird', 'assets/bird.png');

    // Brian
    this.load.image('dude', 'assets/dude.png');
    this.load.image('kicking-dude', 'assets/kickingDude.png');
    this.load.image('punching-dude', 'assets/punchingDude.png');
    this.load.image('jumping-dude', 'assets/jumpingDude.png');
    this.load.image('sliding-dude', 'assets/slidingDude.png');
    this.load.image('jump-kick-dude', 'assets/jumpKickDude.png');    

    // Misc
    this.load.image('ground-block', 'assets/groundblock.png');
    this.load.image('lava', 'assets/lava.png');
    this.load.image('block', 'assets/block.png');

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
    storeThis = this;
    levelsConfig = require("./levels.json");
    setupTitleScreen(this);
}

function setupTitleScreen(game)
{
    var argh = this;
    levelNames = [];
    titleImage = game.add.image(0, 0, "title").setOrigin(0);
    for (var i = 0; i < levelsConfig.Levels.length; i++)
    {
        var level = levelsConfig.Levels[i];
        var text = game.add.bitmapText(930, 130 + (i * 44), 'font2', level.Name);
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
                //onComplete: function() { startLevel(); }, this,
                //onComplete: startLevel,
                //onCompleteScope: argh,
                //onCompleteParams: i,
                ease: 'Cubic.easeIn'
            });
            //tween.callbacks.onComplete = startLevel();
            //setTimeout(startLevel, 1100);
            setupLevel(this.LevelNum, game);
            //titleImage.destroy();
        });
        levelNames.push(text);
    }
}


function startLevel(levelNum, game)
{
    setupLevel.call(levelNum, game);
}

/*
function startLevel(newThis, targets, levelNum)
{
    setupLevel.call(newThis, levelNum);
    //setupLevel(newThis, levelNum);
}
*/

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

    console.log("Set up particles");
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
    console.log("Set up " + sounds.length + " sounds.")
}

function setupLevel(levelNum, game)
{
    trackConfig = levelsConfig.Levels[levelNum];
    bpm = trackConfig.Tempo;

    beatlines = [];
    enemies = [];
    smallestBeatInterval = 999;
    timeElapsed = 0;
    timeInit = 0;
    beatCount = 0;        // 168 = gems
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

    setupBackgroundImage(game, trackConfig);

    initKeys(game);
    setupParticleEffects(game);
    graphics = game.add.graphics({ lineStyle: { width: 2, color: 0xaa0000 }, fillStyle: { color: 0x0000aa } });

    nextEnemyEntry = trackConfig.GameEvents[0].TimeStamp;
    findSmallestInterval();
    initDude(game);
    buildDude(166, 500, 'dude', 'none', 0);    
    setupSound(trackConfig);
    debugLogLevelInfo();

    GameState = GameStateEnum.playing;
}

function setupBackgroundImage(game, trackConfig)
{
    backgroundImage = game.add.image(0, 0, trackConfig.Background).setOrigin(0);
}

function setupSound(trackConfig)
{
    SetupPalette(trackConfig, 1);
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
    
    bufferLoader = new BufferLoader(
        context,
        trackConfig.SampleList,
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
        currentPalette[sampleMap.SourceActionIndex] = sampleMap.SampleFileIndex;
    }
}

function debugLogLevelInfo()
{
    console.log("BPM: " + bpm);
    console.log("Smallest interval: " + smallestBeatInterval);
}

function initKeys(game)
{    
    punchKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    kickKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    jumpKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    slideKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    downKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    debugKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
}

function initDude(game)
{
    dudes['dude'] = game.physics.add.image(166, 500, 'dude');
    dudes['dude'].disableBody(true, true);
    dudes['kicking-dude'] = game.physics.add.image(166, 500, 'kicking-dude');
    dudes['kicking-dude'].disableBody(true, true);
    dudes['punching-dude'] = game.physics.add.image(166, 500, 'punching-dude');
    dudes['punching-dude'].disableBody(true, true);
    dudes['jumping-dude'] = game.physics.add.image(166, 500, 'jumping-dude');
    dudes['jumping-dude'].disableBody(true, true);
    dudes['sliding-dude'] = game.physics.add.image(166, 500, 'sliding-dude');
    dudes['sliding-dude'].disableBody(true, true);
    dudes['jump-kick-dude'] = game.physics.add.image(166, 500, 'jump-kick-dude');
    dudes['jump-kick-dude'].disableBody(true, true);
}

function buildDude(x, y, dudeInstance, action, actionInitiated)
{
    if(dude)
    {
        dude.disableBody(true, true);
    }
    dude = dudes[dudeInstance];
    dude.x = x;
    dude.y = y;
    dude.enableBody(false, x, y, true, true);
    setDude(dude, action, actionInitiated);
}

function findSmallestInterval()
{    
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
}

function setDude(dude, action, actionInitiated)
{
    dude.setData('action', action);
    dude.setData('action-initiated', actionInitiated);
}

function update(time, delta)
{
    var GameStateEnum = Object.freeze({"title":1, "playing":2, "gameover":3})

    if (GameState == GameStateEnum.playing)
        processKey(time, this);

    if (GameState != GameStateEnum.title)
    {
        var moveAmount = getMove(delta);
        calculateBeatsElapsed(time, delta, this);
        updateBeatLines(moveAmount);
        updateEnemies(moveAmount);
    }

    if (GameState == GameStateEnum.playing)
        updateDude(time, this, moveAmount);
}

function updateDude(time, game, moveAmount)
{
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
}

function processSlide(time, game)
{
    var actionInitiated = dude.getData('action-initiated');
    var delta = time - actionInitiated;    
    var bpms = (60 / bpm) * 1000;

    if(delta >= bpms)
    {
        buildDude(dude.x, 500, 'dude', 'none', 0);
    }
}

function processJump(moveAmount, game)
{
    if(dude.getData('action') !== 'jumping' && dude.getData('action') !== 'jump-kick')    
    {
        initJump(); 
    }
    
    dude.y = getCurrentJumpHeight(moveAmount);

    if(jumpProgressX >= jumpDestinationX)
    {
        endJump(game);
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
    jumpY = 400;
    
    jumpDestinationX = startX + ppb;
    jumpDestinationY = startY;

    jumpProgressX = startX;
    dude.setData('action', 'jumping');
}

function endJump(game)
{
    ProcessLand();

    startX = 0;
    startY = 0;

    jumpX = 0;
    jumpY = 700;

    jumpDestinationX = 0;
    jumpDestinationY = 0;
    
    buildDude( dude.x, 500, 'dude', 'none', 0);
}

function processAttack(time, game)
{
    var delta = time - dude.getData('action-initiated');
    var beatDuration = (60 / bpm);

    var smallestInterval = beatDuration * smallestBeatInterval;

    if((delta) >= ((smallestInterval * 1000)/4) && dude.getData('action') !== 'returning')
    {
        var actionInitiated = dude.getData('action-initiated'); 
        buildDude(dude.x, dude.y, 'dude', 'returning', actionInitiated);
    } 
    else if(delta >= (smallestInterval * 1000/2))
    {
        setDude(dude,'none', 0);
    }
}

function processKey(time, game)
{
    if(dude.getData('action') === 'none')
    {
        if (Phaser.Input.Keyboard.JustDown(punchKey))
        {
            ProcessPunch(time);
        }
        else if (Phaser.Input.Keyboard.JustDown(kickKey))
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
    buildDude(dude.x, 550, 'sliding-dude', 'slide', time);
    playSound(5, null);
}

function ProcessSlideEnd(time)
{
}

function ProcessDebug()
{
    console.log("smallestBeatInterval: " + smallestBeatInterval);
    console.log("timeElapsed: " + timeElapsed);
    console.log("timeInit: " + timeInit);
    console.log("beatCount: " + beatCount);
}

function calculateBeatsElapsed(time, delta, game)
{
    if(timeInit === 0)
    {
        timeInit = time;
        timeElapsed = time;
    }
    timeElapsed += delta;

    var bDuration = (60/bpm) * 1000
    
    totalTimeElapsed = (beatCount * bDuration) + timeElapsed;
    totalBeatCountElapsed = beatCount + (timeElapsed / bDuration);
    
    backgroundImage.x = -((backgroundImage.width - 1366) * (totalBeatCountElapsed / trackConfig.LevelEnd));

    looperManager.ProcessTick(totalBeatCountElapsed);
    
    if (totalTimeElapsed >= (nextEnemyEntry * bDuration))
    {
        generateEnemy(game);
    }
    
    if (timeElapsed >= bDuration)
    {
        // timeElapsed -= bDuration;        Seems as though it should be this instead, but it's (maybe?) causing issues
        timeElapsed = 0;
        
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
    generateGameAsset();
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

function generateGameAsset()
{
    generateBeatLine();
}

function generateEnemy(game)
{
    var i = 0;
    for (i; i < trackConfig.GameEvents.length; i++) {
        const enemy = trackConfig.GameEvents[i];
        if(enemy.TimeStamp === nextEnemyEntry)
        {
            buildEnemy(enemy, game);
        }
        else
        {
            break;
        }
    }
    trackConfig.GameEvents.splice(0, i);
    if(trackConfig.GameEvents.length > 0)
    {
        nextEnemyEntry = trackConfig.GameEvents[0].TimeStamp;
    }
}

function buildEnemy(enemyConfig, game)
{
    var y = 0;
    var graphic = "";
    var frame = -1;
    if (enemyConfig.Type === "enemy")
    {
        if (enemyConfig.SubType == "rat")
        {
            y = 535;
            graphic = "rat";
        }
        else if (enemyConfig.SubType == "bird")
        {
            y = 450;
            graphic = "bird";
        }
    }
    else if (enemyConfig.Type === "gem")
    {
        y = 510;
        graphic = "gems";
        frame = Number(enemyConfig.SubType);
    }
    else if (enemyConfig.Type === "block")
    {
        y = 470;
        graphic = "block";
    }
    else if (enemyConfig.Type === "lava")
    {
        y = 580;
        graphic = "lava";
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
    
    var enemy = game.physics.add.image(1366, y, graphic);
    if (frame > -1)
        enemy.setFrame(frame);
    enemy.setData('enemy-data', enemyConfig);   // enemy-type
    enemies.push(enemy);
    addEnemyCollisions(game, enemy);
}

function CreateText(game, textString, width)
{
    currentTextEnd = beatCount + width;
    currentText = game.add.bitmapText(0, 93, 'font', textString);
    currentText.x = (1366 - currentText.width) / 2;
    currentText.alpha = 0;
    var tween = game.tweens.add({
        targets: currentText,
        y: 70,
        alpha: 1,
        duration: 1700,
        ease: 'Cubic.easeOut'
    });
}

function addEnemyCollisions(game, enemy)
{
    for (var key in dudes) {
        var dude = dudes[key];
        game.physics.add.overlap(dude, enemy, hitEnemy);
    }
}

function hitEnemy(dude, enemy)
{
    if((dude.getData('action') === 'punch' || dude.getData('action') === 'jump-kick') && enemy.getData('enemy-data').SubType === 'bird')
    {
        ProcessAirEnemyKilled(enemy);
    }
    else if((dude.getData('action') === 'kick' || dude.getData('action') === 'jump-kick') && enemy.getData('enemy-data').SubType === 'rat')
    {
        ProcessGroundEnemyKilled(enemy);
    }
    else if (enemy.getData('enemy-data').Type === 'gem')
    {
        ProcessCollectableCollected(enemy);
    }
}

function ProcessAirEnemyKilled(enemy)
{
    playSound(2, null);

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
}

function ProcessGroundEnemyKilled(enemy)
{
    playSound(1, null);

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
}

function ProcessCollectableCollected(enemy)
{
    var gemType = Number(enemy.getData('enemy-data').SubType) + 1;
    var soundNumber = gemType + 8;      // 9? 10?
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
    line.x = 1366;
    line.y = 0;
    beatlines.push(line);
}

function updateBeatLines(moveAmount)
{
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

function updateEnemies(moveAmount)
{
    for (let i = enemies.length - 1; i >= 0; i--) {
        var enemy = enemies[i];
        if (!enemy.isDead)
        {
            if(enemy.x < 0)
            {
                enemy.destroy();
                enemy = null;
                enemies.splice(i,1);
            }
            else
            {
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

function getMove(delta)
{
    //Beats per second
    var beatDuration = (60 / bpm);
    //beats per millisecond delta percent
    var bpmsDelta =   delta / (beatDuration * 1000);
    //pixels per beat delta
    var bbpDelta = ppb * bpmsDelta;
    return bbpDelta
}

function playSound(soundNum, time)
{
    var soundIndex = currentPalette[soundNum];
    var source = context.createBufferSource();
    source.buffer = sounds[soundIndex];
    source.connect(context.destination);
    source.start(time);
    looperManager.SoundPlayed(totalBeatCountElapsed, currentPaletteNum, soundIndex);
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
          console.log("loadCount: " + loader.loadCount);
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
    this.loadBuffer(this.urlList[i], i);
  }
