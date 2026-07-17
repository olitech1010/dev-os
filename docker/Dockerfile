FROM ubuntu:22.04

# Avoid tzdata interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Update and install basic tools
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    python3 \
    python3-pip \
    python3-venv \
    php-cli \
    php-mbstring \
    php-xml \
    php-curl \
    php-zip \
    unzip \
    sqlite3 \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (20.x)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Create a non-root user for agents to execute code safely
RUN useradd -ms /bin/bash devagent \
    && echo "devagent ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up working directory
WORKDIR /workspace
RUN chown -R devagent:devagent /workspace

# Switch to non-root user
USER devagent

# Default command keeps the container alive for `docker exec`
CMD ["tail", "-f", "/dev/null"]
