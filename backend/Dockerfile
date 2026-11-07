FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    sudo \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /opt/libraries/arduino /opt/libraries/cache /opt/firmware /tmp/compile

# Copy initialization scripts
COPY scripts/init_toolchain.py /app/scripts/
COPY scripts/install_preinstalled_libs.py /app/scripts/
RUN chmod +x /app/scripts/*.py

# Install Arduino CLI only. Board cores and libraries are kept in the mounted
# runtime volume so image rebuilds do not duplicate multiple gigabytes.
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh && \
    mv ./bin/arduino-cli /usr/local/bin/ && \
    chmod +x /usr/local/bin/arduino-cli

# Create non-root user and adjust permissions
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app && \
    chown -R appuser:appuser /opt/libraries && \
    chown -R appuser:appuser /opt/firmware && \
    chown -R appuser:appuser /tmp/compile

USER appuser

# Expose port
EXPOSE 8000

# Run the application after validating the mounted Arduino toolchain volume
CMD ["sh", "-c", "python3 /app/scripts/ensure_toolchain.py && python3 /app/scripts/install_preinstalled_libs.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
