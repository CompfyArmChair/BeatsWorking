import 'phaser';
var trackConfig;

var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 1366,
    height: 768,
    physics: {
        default: 'arcade',  
        arcade: {
            gravity: { y: 300 }
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
/***************************************/

var beatlines = [];
var enemies = [];
var graphics;
var nextEnemyEntry;
var dude;
var smallestBeatInterval = 999;

var punchKey;
var kickKey;
var jumpKey;
var slideKey;

function preload()
{
    this.load.image('ground', 'assets/filingCabinet.png');
    this.load.image('air', 'assets/clock.png');
    this.load.image('ground-block', 'assets/groundblock.png');
    this.load.image('dude', 'assets/dude.png');
    this.load.image('kicking-dude', 'assets/kickingDude.png');
    this.load.image('punching-dude', 'assets/punchingDude.png');
    this.load.image('jumping-dude', 'assets/jumpingDude.png');
    this.load.image('sliding-dude', 'assets/slidingDude.png');
    this.load.image('jump-kick-dude', 'assets/jumpKickDude.png');    
}

function create()
{    
    trackConfig = require("./track-config.json");
    nextEnemyEntry = trackConfig.enemies[0].entry;

    findSmallestInterval();

    dude = this.add.image(166, 500, 'dude');
    setDude(dude,'none', 0);
    
    graphics = this.add.graphics({ lineStyle: { width: 2, color: 0xaa0000 }, fillStyle: { color: 0x0000aa } });

    punchKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    kickKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    slideKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
}

function findSmallestInterval()
{    
    for (var i = 0; i < trackConfig.enemies.length - 1; i++) {
        const enemy = trackConfig.enemies[i];
        const nextEnemy = trackConfig.enemies[i+1];  
        if(nextEnemy.entry !== enemy.entry)
        {
            var entryDelta = nextEnemy.entry - enemy.entry;
            if(entryDelta < smallestBeatInterval)
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
    processKey(time, this);
    var moveAmount = getMove(delta);
    calculateBeatsElapsed(time, delta, this);
    updateBeatLines(moveAmount);
    updateEnemies(moveAmount);
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
        var x = dude.x;
        var y = 500;         
        dude.destroy();
        dude = game.add.image(x, y, 'dude');
        setDude(dude,'none', 0);
    }
}

var startX = 0;
var startY = 0;

var jumpX = 0;
var jumpY = 400;

var jumpDestinationX = 0;
var jumpDestinationY = 0;
var jumpProgressX = 0;

function processJump(moveAmount, game)
{
    if(dude.getData('action') !== 'jumping' && dude.getData('action') !== 'jump-kick')    
    {
        debugger;
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
    startX = 0;
    startY = 0;

    jumpX = 0;
    jumpY = 700;

    jumpDestinationX = 0;
    jumpDestinationY = 0;
    
    var x = dude.x;
    var y = 500;         
    dude.destroy();
    dude = game.add.image(x, y, 'dude');
    setDude(dude,'none', 0);
}

function processAttack(time, game)
{
    var delta = time - dude.getData('action-initiated');
    var beatDuration = (60 / bpm);

    var smallestInterval = beatDuration * smallestBeatInterval;

    if((delta) >= ((smallestInterval * 1000)/4) && dude.getData('action') !== 'returning')
    {
        var x = dude.x;
        var y = dude.y;
        var actionInitiated = dude.getData('action-initiated');            
        dude.destroy();
        dude = game.add.image(x, y, 'dude');
        setDude(dude, 'returning', actionInitiated);
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
            var x = dude.x;
            var y = dude.y;
            dude.destroy();
            dude = game.add.image(x, y, 'punching-dude');
            setDude(dude, 'punch', time);
        }
        else if (Phaser.Input.Keyboard.JustDown(kickKey))
        {
            var x = dude.x;
            var y = dude.y;
            dude.destroy();
            dude = game.add.image(x, y, 'kicking-dude');
            setDude(dude, 'kick', time);
        }
        else if (Phaser.Input.Keyboard.JustDown(jumpKey))
        {
            var x = dude.x;
            var y = dude.y;
            dude.destroy();
            dude = game.add.image(x, y, 'jumping-dude');
            setDude(dude, 'jump', time);
        }
        else if (Phaser.Input.Keyboard.JustDown(slideKey))
        {
            var x = dude.x;
            var y = 550;
            dude.destroy();
            dude = game.add.image(x, y, 'sliding-dude');
            setDude(dude, 'slide', time);
        }
    } 
    else if(dude.getData('action') === 'jumping')
    {
        if (Phaser.Input.Keyboard.JustDown(kickKey))
        {
            var x = dude.x;
            var y = dude.y;
            dude.destroy();
            dude = game.add.image(x, y, 'jump-kick-dude');
            setDude(dude, 'jump-kick', time);
        }
    }
}

var timeElaspsed = 0;
var timeInit = 0;
var beatCount = 0;
function calculateBeatsElapsed(time, delta, game)
{
    if(timeInit === 0)
    {
        timeInit = time;
        timeElaspsed = time;
    }
    timeElaspsed += delta;

    var bDuration = (60/bpm) * 1000
    
    var totalBeatCountElapsed = (beatCount * bDuration) + timeElaspsed;
    
    if(totalBeatCountElapsed >= (nextEnemyEntry * bDuration))
    {
        generateEnemy(game);
    }
    
    if(timeElaspsed >= bDuration)
    {
        timeElaspsed = 0;
        beatsElapsed();
    }
}

function beatsElapsed()
{
    beatCount++;
    generateGameAsset();
}

function generateGameAsset()
{
    generateBeatLine();
}

function generateEnemy(game)
{
    var i = 0;
    for (i; i < trackConfig.enemies.length; i++) {
        const enemy = trackConfig.enemies[i];
        if(enemy.entry === nextEnemyEntry)
        {
            buildEnemy(enemy, game);
        }
        else
        {
            break;
        }
    }
    trackConfig.enemies.splice(0, i);
    if(trackConfig.enemies.length > 0)
    {
        nextEnemyEntry = trackConfig.enemies[0].entry;
    }
}

function buildEnemy(enemy, game)
{
    var y = 0;
    if(enemy.type === "ground")
    {
        y = 530;
    }

    if(enemy.type === "air")
    {
        y = 430;
    }

    var enemy = game.add.image(1366, y, enemy.type);
    enemy.setScale(0.5);
    enemies.push(enemy);
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
        if(enemy.x < 0)
        {
            enemy.destroy();
            enemy = null;
            enemies.splice(i,1);
        }
        else
        {        
            enemy.x -= moveAmount;  
        }
    }
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
