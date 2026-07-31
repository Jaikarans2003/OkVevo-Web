FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
  ffmpeg \
  libcairo2-dev \
  libpango1.0-dev \
  libglib2.0-dev \
  pkg-config \
  texlive \
  texlive-latex-extra \
  texlive-fonts-extra \
  dvipng \
  cm-super \
  curl \
  unzip \
  fontconfig \
  fonts-dejavu-core \
  && (apt-get install -y fonts-jetbrains-mono \
      || (mkdir -p /usr/share/fonts/truetype/jetbrains-mono \
          && curl -fsSL https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip -o /tmp/jbm.zip \
          && unzip -j /tmp/jbm.zip 'fonts/ttf/*.ttf' -d /usr/share/fonts/truetype/jetbrains-mono \
          && rm -f /tmp/jbm.zip \
          && fc-cache -f)) \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir manim

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src/ ./src/

EXPOSE 3031
CMD ["node", "src/index.js"]
