const keys = require('./keys');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser());

const {
    Pool
} = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    host: keys.pgHost,
    port: keys.pgPort
});

pgClient.on('error', (err) => console.log('Lost pg connection', err));

pgClient
    .query('create table if not exists values (number int)')
    .catch(err => console.log(err));

const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();


app
    .get('/', (req, res) => res.send('HI'))
    .get('/values/all', async (req, res) => {
        const values = await pgClient.query('select * from values');
        res.send(values.rows);
    })
    .get('values/current', async (req, res) => {
        redisClient.hgetall('values', (err, values) => {
            if(err) throw err;
            return res.send(values);
        })
    })
    .post('/values', async(req, res) => {
        const index  = req.body.index;
        if(parseInt(index) > 40) {
            return res.status(422).send('Index too high');
        }

        redisClient.hset('values', index, 'Nothing yet!');
        redisPublisher.publish('insert', index);
        pgClient.query('insert into values (number) values($1)', [index]);

        res.send({ working: true });
    });

app.listen(5000, (err) => {
    if(err) throw err;
    console.log('listening on 5000')
});