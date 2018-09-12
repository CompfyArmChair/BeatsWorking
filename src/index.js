import 'phaser';
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
            gravity: { y: 0 },
            debug: true
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
var ppb = 200;
var levelWidth = 1366;
/***************************************/

var beatlines = [];
var enemies = [];
var graphics;
var nextEnemy;
var dude;
var dudes = {};
var dudeStartingHeight = 499.5;

// Beat calculations
var smallestBeatInterval = 999;
var timeElapsed = 0;
var timeInit = 0;
var beatCount = 0;        // 168 = gems

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

// Particle effects
var enemyDeathParticle;
var enemyEmitter;
var collectableParticle;
var collectableEmitters = [];

// Text
var currentTextEnd;
var currentText;

//Ground and platforms
var platformGraphics;
var platforms = [];


function preload()
{
    this.load.image('rat', 'assets/rat.png');
    this.load.image('bird', 'assets/bird.png');
    this.load.image('ground-block', 'assets/groundblock.png');
    this.load.image('dude', 'assets/dude.png');
    this.load.image('kicking-dude', 'assets/kickingDude.png');
    this.load.image('punching-dude', 'assets/punchingDude.png');
    this.load.image('jumping-dude', 'assets/jumpingDude.png');
    this.load.image('sliding-dude', 'assets/slidingDude.png');
    this.load.image('jump-kick-dude', 'assets/jumpKickDude.png');    
    //this.load.image('lava', 'assets/lava.png');
    this.load.image('block', 'assets/block.png');
    this.load.image('particle1', 'assets/particle.png');
    this.load.image('particle2', 'assets/particle2.png');
    this.load.image('particle3', 'assets/particle3.png');
    this.load.spritesheet('gems', 'assets/gems.png', { frameWidth: 30, frameHeight: 30 });
    this.load.spritesheet('markers', 'assets/markers.png', { frameWidth: 40, frameHeight: 40 });
    this.load.bitmapFont('font', 'assets/font.png', 'assets/font.fnt');
}

function create()
{    
    platformGraphics = this.add.graphics({ fillStyle: { color: 0x696969 } });
    trackConfig = require("./Level 0.json");
    readLevelData(trackConfig);
    nextEnemy = trackConfig.GameEvents[0];
    graphics = this.add.graphics({ lineStyle: { width: 2, color: 0xaa0000 }, fillStyle: { color: 0x0000aa } });
    findSmallestInterval();
    initDude(this);
    buildDude(166, dudeStartingHeight, 'dude', 'none', 0);   
    dude.setData('going-down', false);
    initKeys(this);
    setupInitialGroundPlatform(this);
    setupParticleEffects(this);
    setupSound(trackConfig);
    debugLogLevelInfo();
}

function setupInitialGroundPlatform(game)
{
    var totalWidth = levelWidth;
    buildPlatformBlock(0, 564, totalWidth, game);
}

function buildPlatformBlock(x, y, width, game)
{
    var platformBlock = game.physics.add.image(x, y, 'ground-block');    
    platformBlock.setDisplaySize(width, 220);
    platformBlock.setOrigin(0,0);
    platformBlock.setSize(width - 85, 1, false).setOffset(207, 178);
    //platformBlock.setAlpha(0);
     platforms.push(platformBlock); 
     for (var key in dudes) {
        var dude = dudes[key];
        game.physics.add.overlap(dude, platformBlock, stop);
    }
}

function stop(dude, platformBlock)
{
    var lastY = dude.getData('last-y');  
    var bounds = platformBlock.getBounds();
    var yRelativeToPlatform = bounds.y - dude.height/2;

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
            buildDude(dude.x, yRelativeToPlatform, 'dude', 'none', 0);   
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
        if(platform.x + platform.width >= 166) //pos of dude
        {
            debugger;
            if(platformBlock.y < platform.y)
            {
                return false;
            }
        }
    }
    return true;
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

function readLevelData(trackConfig)
{
    bpm = trackConfig.Tempo;
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
    dudes['dude'] = game.physics.add.image(166, dudeStartingHeight, 'dude');
    dudes['dude'].disableBody(true, true);
    dudes['kicking-dude'] = game.physics.add.image(166, dudeStartingHeight, 'kicking-dude');
    dudes['kicking-dude'].disableBody(true, true);
    dudes['punching-dude'] = game.physics.add.image(166, dudeStartingHeight, 'punching-dude');
    dudes['punching-dude'].disableBody(true, true);
    dudes['jumping-dude'] = game.physics.add.image(166, dudeStartingHeight, 'jumping-dude');
    dudes['jumping-dude'].disableBody(true, true);
    dudes['sliding-dude'] = game.physics.add.image(166, dudeStartingHeight, 'sliding-dude');
    dudes['sliding-dude'].disableBody(true, true);
    // dudes['jump-kick-dude'] = game.physics.add.image(166, 499, 'jump-kick-dude');
    // dudes['jump-kick-dude'].disableBody(true, true);
}

function buildDude(x, y, dudeInstance, action, actionInitiated)
{   

    var yData = dudeStartingHeight;
    if(dude)
    {      
        yData = dude.getData('last-y') === undefined ? dudeStartingHeight : dude.getData('last-y');
        dude.disableBody(true, true);
    } 
    dude = dudes[dudeInstance];    
    dude.x = x;
    dude.y = y;
    dude.enableBody(true, x, y, true, true);
    setDude(dude, action, actionInitiated, yData);
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

function setDude(dude, action, actionInitiated, yData)
{   
    dude.setData('last-y', yData);
    dude.setData('action', action);
    dude.setData('action-initiated', actionInitiated);
}

function update(time, delta)
{       
    dude.setData('last-y', dude.y);
    processKey(time, this);
    var moveAmount = getMove(delta);
    calculateBeatsElapsed(time, delta, this);
    updateBeatLines(moveAmount);    
    updateEnemies(moveAmount);
    updateDude(time, this, moveAmount);
    updatePlatforms(moveAmount);    
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

    if(delta >= bpms)
    {
        buildDude(dude.x, dudeStartingHeight, 'dude', 'none', 0);
    }
}

function processFall(moveAmount, game)
{
    if(dude.getData('action') === 'none' || dude.getData('action') === 'fall')    
    {
        initFall(); 
    }
    
    dude.y = getCurrentJumpHeight(moveAmount);
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
    
    jumpDestinationX = startX + ppb;
    jumpDestinationY = startY;

    jumpProgressX = startX;
    dude.setData('action', 'jumping');
}

function endJump(game, y)
{
    if(dude.getData('action') !== 'falling')
    {
        ProcessLand();
    }

    startX = 0;
    startY = 0;

    jumpX = 0;
    jumpY = 700;

    jumpDestinationX = 0;
    jumpDestinationY = 0;
    
    buildDude( dude.x, y, 'dude', 'none', 0);
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
        else if (Phaser.Input.Keyboard.JustDown(downKey))
        { 
            ProcessDrop(time);
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
    buildDude(dude.x, dude.y, 'jumping-dude', 'fall', time);
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
    
    var totalBeatCountElapsed = (beatCount * bDuration) + timeElapsed;
    
    // if(isGapDuringNextBeat())
    // {

    // }
    // else
    // {
    //     if (timeElapsed >= bDuration)
    //     {
    //         generateGroundBlock();
    //     }
    // }

    if (totalBeatCountElapsed >= (nextEnemy.TimeStamp * bDuration))
    {       
        generateAsset(game); 
               
    }
    
    if (timeElapsed >= bDuration)
    {
        // timeElapsed -= bDuration;        Seems as though it should be this instead, but it's (maybe?) causing issues
        running = true;
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

function generateAsset(game)
{
    var i = 0;
    for (i; i < trackConfig.GameEvents.length; i++) {
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
        }
        else
        {
            break;
        }
    }
    trackConfig.GameEvents.splice(0, i);
    if(trackConfig.GameEvents.length > 0)
    {
        nextEnemy = trackConfig.GameEvents[0];
    }
}

function buildPlatform(platformConfig, game)
{
    var y = platformConfig.YPos;
    var width = platformConfig.Width * ppb;
    buildPlatformBlock(levelWidth, y, width, game);
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
    // else if (enemyConfig.Type === "lava")
    // {
    //     y = 580;
    //     graphic = "lava";
    // }
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
        frame = 7 + Number(enemyConfig.SubType);
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
    
    var enemy = game.physics.add.image(levelWidth, y, graphic);
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
        //onComplete: destroyBody,
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
    var soundNumber = gemType + 9;
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
    line.x = levelWidth;
    line.y = 0;
    beatlines.push(line);
}

var running = false;
function updatePlatforms(moveAmount)
{
    if(running)
    {
        platformGraphics.clear();        
        for (let i = 0; i < platforms.length; i++) {
            var platform = platforms[i];        
            if(platform.x <= 0 - (platform.width * 4) + 200)
            {
                platform.destroy();
                platform = null;
                platforms.splice(i, 1);
            }
            else
            {
                platform.x -= moveAmount;           
            }
        }
    }
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
                    ProcessMarkerReached(enemy);
                }
            }
        }
    }
}

function ProcessMarkerReached(enemy)
{
    var enemyData = enemy.getData('enemy-data');
    if (enemyData == null)
        return;

    if (enemyData.Type == "LoopRecordStart")
    {
    }
    else if (enemyData.Type == "LoopRecordStop")
    {
    }
    else if (enemyData.Type == "LoopPlayStart")
    {
    }
    else if (enemyData.Type == "LoopPlayStop")
    {
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

function playSound(soundNum, time) {
    var soundIndex = currentPalette[soundNum];
    if(soundIndex)
    {
        var source = context.createBufferSource();
        source.buffer = sounds[soundIndex];
        source.connect(context.destination);
        source.start(time);
    }
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