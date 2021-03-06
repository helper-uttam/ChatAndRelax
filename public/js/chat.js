const socket = io()

// Elements
const $messageForm = document.querySelector('#message-form')
const $messageFormInput = $messageForm.querySelector('input')
const $messageFormButton = $messageForm.querySelector('button')
const $sendLocationButton = document.querySelector('#send-location')
const $messages = document.querySelector('#messages')

// Templates
const messageTemplate = document.querySelector('#message-template').innerHTML
const locationMessageTemplate = document.querySelector('#location-message-template').innerHTML
const sidebarTemplate = document.querySelector('#sidebar-template').innerHTML

// Options
const { username, room } = Qs.parse(location.search, { ignoreQueryPrefix: true })

const autoscroll = () => {
    // New message element
    const $newMessage = $messages.lastElementChild

    // Height of the new message
    const newMessageStyles = getComputedStyle($newMessage)
    const newMessageMargin = parseInt(newMessageStyles.marginBottom)
    const newMessageHeight = $newMessage.offsetHeight + newMessageMargin

    // Visible height
    const visibleHeight = $messages.offsetHeight

    // Height of messages container
    const containerHeight = $messages.scrollHeight

    // How far have I scrolled?
    const scrollOffset = $messages.scrollTop + visibleHeight

    if (containerHeight - newMessageHeight <= scrollOffset) {
        $messages.scrollTop = $messages.scrollHeight
    }
}

var audio;
var mood;

if(window.innerWidth < 1200){
    document.querySelector('#music').style.display = 'none'
}

function playAudio(mood) {
    if (mood.toLowerCase() == 'alone'|| mood.toLowerCase() == 'broken') {
        audio = new Audio('../img/Alone.mp3');
        audio.play();
    }else if(mood.toLowerCase() == 'happy'|| mood.toLowerCase() == 'excited'){
        audio = new Audio('../img/Happy.mp3');
        audio.play();
    }else{
        audio = new Audio('../img/Sad.mp3');
        audio.play();
    }
}

function pauseAudio() {
    if(audio)
        audio.pause();
}

let email = "";

// to take input
document.querySelector('#email').addEventListener('input', (e) => {
    email = e.target.value;
    document.getElementById('sendInvite').removeAttribute('disabled')
})
//on click
document.getElementById('sendInvite').addEventListener('click', async() => {

    const response = await fetch('/invite', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        invite: `https://chatandrelax.herokuapp.com/chat.html?username=invitedUser&room=${room}`,
                        email: email
                    })
            })
    document.getElementById('sendInvite').setAttribute('disabled', true)
})

let pause = false;

// pause or play misuc on click
document.querySelector('#music').addEventListener('click', () => {
    pause = !pause;
    if(pause){
        pauseAudio();
    }
    else{
        playAudio(mood);
    }
})

socket.on('message', (message) => {
    console.log(message)
    mood = room;
    const html = Mustache.render(messageTemplate, {
        username: message.username,
        message: message.text,
        createdAt: moment(message.createdAt).format('h:mm a')
    })
    $messages.insertAdjacentHTML('beforeend', html)
    autoscroll()
})

socket.on('locationMessage', (message) => {
    console.log(message)
    const html = Mustache.render(locationMessageTemplate, {
        username: message.username,
        url: message.url,
        createdAt: moment(message.createdAt).format('h:mm a')
    })
    $messages.insertAdjacentHTML('beforeend', html)
    autoscroll()
})

socket.on('roomData', ({ room, users }) => {
    const html = Mustache.render(sidebarTemplate, {
        room,
        users
    })
    document.querySelector('#sidebar').innerHTML = html
})

$messageForm.addEventListener('submit', (e) => {
    e.preventDefault()

    $messageFormButton.setAttribute('disabled', 'disabled')

    const message = e.target.elements.message.value

    socket.emit('sendMessage', message, (error) => {
        $messageFormButton.removeAttribute('disabled')
        $messageFormInput.value = ''
        $messageFormInput.focus()

        if (error) {
            return console.log(error)
        }

        console.log('Message delivered!')
    })
})

$sendLocationButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
        return alert('Geolocation is not supported by your browser.')
    }

    $sendLocationButton.setAttribute('disabled', 'disabled')

    navigator.geolocation.getCurrentPosition((position) => {
        socket.emit('sendLocation', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        }, () => {
            $sendLocationButton.removeAttribute('disabled')
            console.log('Location shared!')  
        })
    })
})

socket.emit('join', { username, room }, (error) => {
    if (error) {
        alert(error)
        location.href = '/'
    }
})