// 1. Importar las librerías necesarias
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const rateLimitStore = {}; // Memoria para almacenar los intentos por IP
require('dotenv').config(); // Cargar las variables del archivo .env

// 2. Crear la app con Express
const app = express();
const port = process.env.PORT || 3000;

// 3. Configurar middlewares
app.use(cors());
app.use(express.json());

// 4. Configurar conexión con OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 5. Configurar el límite: 5 intentos cada 5 minutos (300 segundos)
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutos

// Middleware para limitar por IP
app.use('/chat', (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();

  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = { attempts: 0, firstAttempt: now };
  }

  const userData = rateLimitStore[ip];

  if (now - userData.firstAttempt > WINDOW_MS) {
    userData.attempts = 0;
    userData.firstAttempt = now;
  }

  if (userData.attempts >= MAX_ATTEMPTS) {
    const timeLeft = Math.ceil((WINDOW_MS - (now - userData.firstAttempt)) / 1000);
    return res.json({
      reply: "Lo siento, no te quedan más intentos.",
      remainingAttempts: 0,
      timeLeft: timeLeft
    });
  }

  userData.attempts++;
  req.rateLimitInfo = {
    remainingAttempts: MAX_ATTEMPTS - userData.attempts,
    timeLeft: Math.ceil((WINDOW_MS - (now - userData.firstAttempt)) / 1000)
  };

  next();
});

// 6. Endpoint para el chat
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    const completion = await openai.chat.completions.create({
      model: "ft:gpt-3.5-turbo-1106:personal:espa-a:BodZMlXe",
      messages: [{ role: "user", content: message }],
    });

    res.json({
      reply: completion.choices[0].message.content,
      ...req.rateLimitInfo
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al comunicarse con OpenAI" });
  }
});

// 7. Iniciar el servidor
// Ruta raíz para responder a GET /
app.get('/', (req, res) => {
  res.send('Hola, servidor funcionando en Render!');
});

// Aquí van las demás rutas o lógica del chatbot

app.listen(port, () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
