const Websocket = require("ws")

var ws;

const makeWsConnection = ({ signature, userId, orgId }) => {
    ws = new Websocket(`http://localhost:4000/kiki/?type=kazana&signature=${signature}&userId=${userId}&orgId=${orgId}`)

    const heartbeat = () => {
        clearTimeout(ws.pingTimeout)
        ws.pingTimeout = setTimeout(() => {
            process.send(JSON.stringify({ action: "kiki-disconnected" }))
            ws.close()
            ws = null
        }, 30000 + 1000)
    }

    ws.onopen = () => {
        process.send(JSON.stringify({ action: "kiki-connected" }))
        heartbeat()
    }
    ws.onclose = () => {
        clearTimeout(ws.pingTimeout)
        ws = null
    }
    ws.onmessage = (message) => {
        const msg = JSON.parse(message.data)
        switch(msg.action) {
            case "ping":
                heartbeat()
                ws.send(JSON.stringify({ action: "pong" }))
                break
            case "start-talk":
                // edge.jsでNAudioを起動
                process.send(message.data)
                break
            case "end-talk":
                // 
                process.send(message.data)
                break
            default:
                process.send(message.data)
                break
        }
    }
}

process.on("message", message => {
    const msg = JSON.parse(message)
    console.log(msg) 
    switch(msg.action) {
        case "login":
            makeWsConnection(msg.payload)
            break
        case "logout":
            if(!!ws) {
                ws.close()
                ws = null
            }            
            break
        default:
            break;
    }
})