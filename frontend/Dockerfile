FROM node:18

WORKDIR /app

# Copiamos solo los archivos necesarios para instalar primero
COPY package*.json ./

# Instalamos dentro del contenedor para Linux (¡clave!)
RUN npm install

# Luego copiamos el resto del código (después de npm install)
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
