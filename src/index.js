const path = require('path')
const http = require('http')
const sgMail = require('@sendgrid/mail');
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const cors = require('cors')
const { Client } = require("pg");
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config()

const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)


const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

//Database
const client = new Client(process.env.DATABASE_URL);

function insertData(ID, USERNAME, ROOM) {
    const statement =  `INSERT INTO user VALUES (${USERNAME} ,${ROOM} )`
    client.query(statement, () => {console.log('success');})
}


(async () => {
  try {
    await client.connect();
    const results = await client.query("");
    if(results){
        console.log("Database connected!");
    }
  } catch (err) {
    console.error("error executing query:", err);
  } finally {
    client.end();
  }
})();

io.on('connection', (socket) => {
    console.log('New WebSocket connection')

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })
        // insertData(2, user.username, user.room);

        if (error) {
            return callback(error)
        }

        socket.join(user.room)
        
        socket.emit('message', generateMessage('ChatAndRelax bot', 'Welcome!'))
        socket.broadcast.to(user.room).emit('message', generateMessage('ChatAndRelax bot', `${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)
        const filter = new Filter()

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed!')
        }

        io.to(user.room).emit('message', generateMessage(user.username, message))
        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('ChatAndRelax bot', `${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

// sending invites
function sendEmail(email, invite) {
    if (email.length < 6) {
        return alert("check the mail you have entered!")
    }

    const SECRET_KEY = `${process.env.SENDGRID_API_KEY}`;
    sgMail.setApiKey(SECRET_KEY);
    const mail = String(process.env.MAIL);
    const msg = {
        to: email,
        from: mail, 
        subject: "Your friend invited you to join the conversation",
        html: `<strong>Hi there, Thanks for using ChatAndRelax. Your friend is waiting in the lobby and here is the <a href=${invite}>link</a> to join</strong>`,
    };
    sgMail
    .send(msg)
    .then(() => {}, error => {
        console.error(error);

        if (error.response) {
        console.error(error.response.body)
        }
    });
    (async () => {
        try {
        await sgMail.send(msg);
        } catch (error) {
        console.error(error);
    
        if (error.response) {
            console.error(error.response.body)
        }
        }
    })();
}
app.post('/invite', (req, res) => {
    sendEmail(req.body.email, req.body.invite)
    res.send("Email sent!")
})
server.listen(port, () => {
    console.log(`Server is up on port ${port}!`)
})