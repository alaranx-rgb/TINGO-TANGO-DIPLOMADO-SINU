const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Sus 4 preguntas oficiales sincronizadas para toda la sala
const preguntasOficiales = [
  {
    categoria: 'Autoridad Aduanera',
    texto: '¿Nos explica brevemente qué conoce usted de la DIAN?'
  },
  {
    categoria: 'Régimen Franco',
    texto: '¿Nos explica qué conoce de una Zona Franca?'
  },
  {
    categoria: 'Negociación Internacional',
    texto: '¿Qué son los términos de negociación internacional - INCOTERMS?'
  },
  {
    categoria: 'Clasificación y Tributos',
    texto: '¿Qué logramos entender por Arancel de Aduanas?'
  }
];

let colaPreguntas = [];
let jugadores = [];
let intervaloPelota = null;
let timeoutTango = null;
let indiceActual = 0;
let rondaActiva = false;

function obtenerSiguientePregunta() {
  if (colaPreguntas.length === 0) {
    colaPreguntas = [...preguntasOficiales].sort(() => Math.random() - 0.5);
  }
  return colaPreguntas.pop();
}

function limpiarTimers() {
  if (intervaloPelota) {
    clearInterval(intervaloPelota);
    intervaloPelota = null;
  }
  if (timeoutTango) {
    clearTimeout(timeoutTango);
    timeoutTango = null;
  }
}

io.on('connection', (socket) => {
  // Enviar lista actual al conectar
  socket.emit('listaJugadores', jugadores);

  socket.on('unirse', (nombre) => {
    const nombreLimpio = String(nombre || '').trim().slice(0, 40);
    if (!nombreLimpio) return;

    const yaExiste = jugadores.find((j) => j.id === socket.id);
    if (yaExiste) {
      yaExiste.nombre = nombreLimpio;
    } else {
      jugadores.push({ id: socket.id, nombre: nombreLimpio });
    }

    io.emit('listaJugadores', jugadores);
  });

  socket.on('iniciarJuego', () => {
    if (jugadores.length === 0 || rondaActiva) return;

    rondaActiva = true;
    limpiarTimers();

    indiceActual = Math.floor(Math.random() * jugadores.length);
    const duracionRondaMs = Math.floor(Math.random() * 6000) + 5000; // Entre 5 y 11 segundos

    io.emit('estadoPelota', { poseedor: jugadores[indiceActual] });

    intervaloPelota = setInterval(() => {
      if (jugadores.length === 0) {
        limpiarTimers();
        rondaActiva = false;
        return;
      }
      indiceActual = (indiceActual + 1) % jugadores.length;
      io.emit('estadoPelota', { poseedor: jugadores[indiceActual] });
    }, 800);

    timeoutTango = setTimeout(() => {
      limpiarTimers();
      rondaActiva = false;

      if (jugadores.length === 0) return;

      const perdedor = jugadores[indiceActual] || jugadores[0];
      const pregunta = obtenerSiguientePregunta();

      io.emit('tangoFinal', {
        perdedor,
        categoria: pregunta.categoria,
        penitencia: pregunta.texto
      });
    }, duracionRondaMs);
  });

  socket.on('disconnect', () => {
    const idxEliminado = jugadores.findIndex((j) => j.id === socket.id);
    if (idxEliminado !== -1) {
      jugadores.splice(idxEliminado, 1);
      if (indiceActual >= jugadores.length) {
        indiceActual = 0;
      }
      io.emit('listaJugadores', jugadores);
    }

    if (jugadores.length === 0) {
      limpiarTimers();
      rondaActiva = false;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor Tingo Tango escuchando en el puerto ${PORT}`);
});