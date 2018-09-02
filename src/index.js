import 'phaser';
var trackConfig;

var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 1366,
    height: 768,
    physics: {
        default: 'arcade',        
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);
var bpm = 60;
//pixels per beat
var ppb = 200;
var beatlines = [];
var enemies = [];
var graphics;
var nextEnemyEntry;


function preload()
{
    this.load.image('ground', 'assets/filingCabinet.png');
    this.load.image('air', 'assets/clock.png');
    this.load.image('ground-block', 'assets/groundblock.png');
    this.load.image('dude', 'assets/dude.png');
}

function create()
{    
    trackConfig = require("./track-config.json");
    nextEnemyEntry = trackConfig.enemies[0].entry;

    var dude = this.add.image(166, 500, 'dude');
    graphics = this.add.graphics({ lineStyle: { width: 2, color: 0xaa0000 }, fillStyle: { color: 0x0000aa } });
}

function update(time, delta)
{       
    var moveAmount = getMove(delta);
    calculateBeatsElapsed(time, delta, this);
    updateBeatLines(moveAmount);
    updateEnemies(moveAmount);
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
    if(trackConfig.enemies.length > 1)
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
