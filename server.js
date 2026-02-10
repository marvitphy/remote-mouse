const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const os = require('os');
const koffi = require('koffi');

const user32 = koffi.load('user32.dll');

const POINT = koffi.struct('POINT', {
    x: 'long',
    y: 'long'
});

const GetCursorPos = user32.func('bool GetCursorPos(_Out_ POINT* lpPoint)');
const SetCursorPos = user32.func('bool SetCursorPos(int X, int Y)');
const mouse_event = user32.func('void mouse_event(uint32 dwFlags, uint32 dx, uint32 dy, uint32 dwData, uintptr_t dwExtraInfo)');
const keybd_event = user32.func('void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr_t dwExtraInfo)');

const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const MOUSEEVENTF_RIGHTDOWN = 0x0008;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const MOUSEEVENTF_WHEEL = 0x0800;

const KEYEVENTF_KEYUP = 0x0002;
const VK_CONTROL = 0x11;
const VK_ALT = 0x12;
const VK_TAB = 0x09;
const VK_LWIN = 0x5B;
const VK_D = 0x44;
const VK_LEFT = 0x25;
const VK_RIGHT = 0x27;
const VK_SNAPSHOT = 0x2C;
const VK_VOLUME_MUTE = 0xAD;
const VK_VOLUME_DOWN = 0xAE;
const VK_VOLUME_UP = 0xAF;
const VK_MEDIA_NEXT = 0xB0;
const VK_MEDIA_PREV = 0xB1;
const VK_MEDIA_STOP = 0xB2;
const VK_MEDIA_PLAY_PAUSE = 0xB3;
const VK_C = 0x43;
const VK_V = 0x56;
const VK_Z = 0x5A;
const VK_A = 0x41;
const VK_S = 0x53;
const VK_F = 0x46;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const SENSITIVITY = 2.0;
const PRECISION_MULT = 0.3;

app.use(express.static(path.join(__dirname, 'public')));

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

function getMousePos() {
    const point = {};
    GetCursorPos(point);
    return { x: point.x, y: point.y };
}

function moveMouse(x, y) {
    SetCursorPos(x, y);
}

function mouseDown(button) {
    if (button === 'left') {
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
    } else if (button === 'right') {
        mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
    }
}

function mouseUp(button) {
    if (button === 'left') {
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    } else if (button === 'right') {
        mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
    }
}

function clickMouse(button) {
    mouseDown(button);
    mouseUp(button);
}

function doubleClickMouse() {
    clickMouse('left');
    clickMouse('left');
}

function scrollMouse(amount) {
    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, amount * 120, 0);
}

function zoomMouse(amount) {
    keybd_event(VK_CONTROL, 0, 0, 0);
    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, amount * 120, 0);
    keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
}

function shortcut(action) {
    switch (action) {
        case 'alttab':
            keybd_event(VK_ALT, 0, 0, 0);
            keybd_event(VK_TAB, 0, 0, 0);
            keybd_event(VK_TAB, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_ALT, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'desktop':
            keybd_event(VK_LWIN, 0, 0, 0);
            keybd_event(VK_D, 0, 0, 0);
            keybd_event(VK_D, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'prevdesktop':
            keybd_event(VK_LWIN, 0, 0, 0);
            keybd_event(VK_CONTROL, 0, 0, 0);
            keybd_event(VK_LEFT, 0, 0, 0);
            keybd_event(VK_LEFT, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'nextdesktop':
            keybd_event(VK_LWIN, 0, 0, 0);
            keybd_event(VK_CONTROL, 0, 0, 0);
            keybd_event(VK_RIGHT, 0, 0, 0);
            keybd_event(VK_RIGHT, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'volumeup':
            keybd_event(VK_VOLUME_UP, 0, 0, 0);
            keybd_event(VK_VOLUME_UP, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'volumedown':
            keybd_event(VK_VOLUME_DOWN, 0, 0, 0);
            keybd_event(VK_VOLUME_DOWN, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'mute':
            keybd_event(VK_VOLUME_MUTE, 0, 0, 0);
            keybd_event(VK_VOLUME_MUTE, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'playpause':
            keybd_event(VK_MEDIA_PLAY_PAUSE, 0, 0, 0);
            keybd_event(VK_MEDIA_PLAY_PAUSE, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'nexttrack':
            keybd_event(VK_MEDIA_NEXT, 0, 0, 0);
            keybd_event(VK_MEDIA_NEXT, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'prevtrack':
            keybd_event(VK_MEDIA_PREV, 0, 0, 0);
            keybd_event(VK_MEDIA_PREV, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'screenshot':
            keybd_event(VK_SNAPSHOT, 0, 0, 0);
            keybd_event(VK_SNAPSHOT, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'copy':
            keybd_event(VK_CONTROL, 0, 0, 0);
            keybd_event(VK_C, 0, 0, 0);
            keybd_event(VK_C, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'paste':
            keybd_event(VK_CONTROL, 0, 0, 0);
            keybd_event(VK_V, 0, 0, 0);
            keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'undo':
            keybd_event(VK_CONTROL, 0, 0, 0);
            keybd_event(VK_Z, 0, 0, 0);
            keybd_event(VK_Z, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'selectall':
            keybd_event(VK_CONTROL, 0, 0, 0);
            keybd_event(VK_A, 0, 0, 0);
            keybd_event(VK_A, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'save':
            keybd_event(VK_CONTROL, 0, 0, 0);
            keybd_event(VK_S, 0, 0, 0);
            keybd_event(VK_S, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
            break;
        case 'find':
            keybd_event(VK_CONTROL, 0, 0, 0);
            keybd_event(VK_F, 0, 0, 0);
            keybd_event(VK_F, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
            break;
    }
}

app.get('/qr', (req, res) => {
    const ip = getLocalIP();
    const url = `http://${ip}:${PORT}`;
    res.json({ url, ip, port: PORT });
});

const clientState = new Map();
const WATCHDOG_TIMEOUT = 3000;

wss.on('connection', (ws) => {
    console.log('Client connected');

    const state = { mouseDown: false, lastActivity: Date.now(), subX: 0, subY: 0 };
    clientState.set(ws, state);

    const watchdog = setInterval(() => {
        if (state.mouseDown && Date.now() - state.lastActivity > WATCHDOG_TIMEOUT) {
            console.log('Watchdog: forcing mouseup (client inactive)');
            mouseUp('left');
            mouseUp('right');
            state.mouseDown = false;
        }
    }, 1000);

    ws.on('message', (data) => {
        state.lastActivity = Date.now();
        try {
            const msg = JSON.parse(data);
            handleMouseEvent(msg, state);
        } catch (err) {
            console.error('Invalid message:', err.message);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(watchdog);
        if (state.mouseDown) {
            console.log('Forcing mouseup on disconnect');
            mouseUp('left');
            mouseUp('right');
        }
        clientState.delete(ws);
    });
});

function handleMouseEvent(msg, state) {
    try {
        switch (msg.type) {
            case 'move':
                const sens = msg.precision ? SENSITIVITY * PRECISION_MULT : SENSITIVITY;
                if (state) {
                    state.subX += msg.dx * sens;
                    state.subY += msg.dy * sens;
                    const moveX = Math.trunc(state.subX);
                    const moveY = Math.trunc(state.subY);
                    if (moveX !== 0 || moveY !== 0) {
                        state.subX -= moveX;
                        state.subY -= moveY;
                        const pos = getMousePos();
                        moveMouse(pos.x + moveX, pos.y + moveY);
                    }
                } else {
                    const pos = getMousePos();
                    moveMouse(pos.x + Math.round(msg.dx * sens), pos.y + Math.round(msg.dy * sens));
                }
                break;

            case 'mousedown':
                mouseDown(msg.button || 'left');
                if (state) state.mouseDown = true;
                break;

            case 'mouseup':
                mouseUp(msg.button || 'left');
                if (state) state.mouseDown = false;
                break;

            case 'click':
                clickMouse(msg.button);
                break;

            case 'doubleclick':
                doubleClickMouse();
                break;

            case 'scroll':
                const scrollAmount = Math.round(msg.dy / 10);
                scrollMouse(-scrollAmount);
                break;

            case 'zoom':
                const zoomAmount = Math.round(msg.delta / 50);
                if (zoomAmount !== 0) zoomMouse(zoomAmount);
                break;

            case 'shortcut':
                shortcut(msg.action);
                break;

            default:
                break;
        }
    } catch (err) {
        console.error('Mouse error:', err.message);
    }
}

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('\n========================================');
    console.log('  Remote Mouse Control Server');
    console.log('========================================');
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`  Network: http://${localIP}:${PORT}`);
    console.log('========================================');
    console.log('  Open the Network URL on your phone');
    console.log('========================================\n');
});