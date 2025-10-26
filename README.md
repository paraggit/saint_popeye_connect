# SaintPopeye Connect

A sleek and responsive web-based chatbot application that connects to a local Ollama instance. It allows users to configure the Ollama host, list, select, switch, and pull AI models for interactive chat sessions.

## Features

- **Connect to any Ollama Host**: Easily configure the server address for your local or remote Ollama instance.
- **Model Management**: List all available models, refresh the list, and select a model for chatting.
- **Pull New Models**: Download new models directly from the Ollama library within the app.
- **Model Details**: View key details of the selected model, such as family, parameter size, and quantization level.
- **Interactive Chat**: Real-time, streaming chat responses from the selected model.
- **Multimodal Support**: Upload images to chat with vision-capable models.
- **Code Highlighting**: Syntax highlighting for code blocks in chat messages.
- **Chat Management**: Clear the conversation history to start fresh.
- **Responsive Design**: A clean, modern UI that works on both desktop and mobile.

## Prerequisites

Before you begin, ensure you have the following installed:
- [Ollama](https://ollama.com/)
- **[Node.js](https://nodejs.org/) (v20+ REQUIRED)**
- npm, yarn, or pnpm

## Getting Started (Local Development)

Follow these steps to get the application running on your development machine.

### 1. Clone the Repository

Clone the project to your local machine.
```bash
git clone https://github.com/saintpopeye/ollama-ui.git
cd ollama-ui
```

### 2. Install Dependencies

Navigate to the project directory and install the required dependencies:
```bash
npm install
```
If you get an error about an unsupported engine, your Node.js version is too old. Please see the Troubleshooting section below.

### 3. Configure Ollama for CORS (Crucial Step!)

For the web application to communicate with your Ollama server, you must configure Ollama's Cross-Origin Resource Sharing (CORS) policy to allow connections from the app's URL.

**This is the most common point of failure.** The change will not take effect until you **completely quit and restart** your Ollama server.

Follow the instructions for your specific operating system and setup:

#### macOS

- **For the Ollama Desktop App:**
  1. Open the Terminal app and run:
     ```bash
     launchctl setenv OLLAMA_ORIGINS '*'
     ```
  2. Quit the Ollama app from the menu bar and restart it.

- **For Command-Line `ollama serve`:**
  Run this in your terminal *before* starting the server:
  ```bash
  export OLLAMA_ORIGINS='*'
  ```

#### Windows

- **For the Ollama Desktop App (Permanent):**
  1. Open **Command Prompt as Administrator** and run:
     ```powershell
     setx OLLAMA_ORIGINS "*"
     ```
  2. **Restart your computer** for the change to take effect, then restart the Ollama app.

- **For Command-Line `ollama serve` (Temporary):**
  - In PowerShell:
    ```powershell
    $env:OLLAMA_ORIGINS = '*'
    ```
  - In Command Prompt (CMD):
    ```cmd
    set OLLAMA_ORIGINS=*
    ```

#### Linux

- **Temporary (for the current terminal session):**
  ```bash
  export OLLAMA_ORIGINS='*'
  ```
- **Permanent (using systemd):**
  1. Edit the systemd service file:
     ```bash
     sudo systemctl edit ollama.service
     ```
  2. Add the following lines, then save and exit:
     ```ini
     [Service]
     Environment="OLLAMA_ORIGINS=*"
     ```
  3. Reload and restart the service:
     ```bash
     sudo systemctl daemon-reload && sudo systemctl restart ollama
     ```

#### Docker

Add the `-e OLLAMA_ORIGINS='*'` environment variable to your `docker run` command.

```bash
docker run -d -p 11434:11434 -e OLLAMA_ORIGINS='*' --name ollama ollama/ollama
```

### 4. Running the Development Server

Once Ollama is configured, start the application's development server:

```bash
npm run dev
```

The application should now be running at `http://localhost:5173` (or the next available port).

---

## Deploying on Raspberry Pi

You can easily deploy this application to a Raspberry Pi to act as a dedicated server. A deployment script is included to automate the entire process.

### Prerequisites for Pi

- A Raspberry Pi with Raspberry Pi OS (or another Debian-based Linux distribution).
- An active internet connection.
- SSH access or a terminal directly on the Pi.

### Deployment Steps

1.  **Clone the Repository on your Pi:**
    ```bash
    git clone https://github.com/saintpopeye/ollama-ui.git
    cd ollama-ui
    ```

2.  **Run the Deployment Script:**
    The script automates everything: installing Ollama, configuring CORS, installing the correct Node.js version, building the app, and setting up an Nginx web server.

    Make the script executable:
    ```bash
    chmod +x deploy_rpi.sh
    ```

    Run the script with `sudo`:
    ```bash
    sudo ./deploy_rpi.sh
    ```

3.  **Access the Application:**
    Once the script finishes, it will display the IP address of your Raspberry Pi. You can access **SaintPopeye Connect** from any device on the same network by navigating to `http://<YOUR_PI_IP_ADDRESS>` in your web browser.

---
## Troubleshooting

### `TypeError: crypto.hash is not a function`

This error means your version of Node.js is too old for Vite, the project's build tool.

**Solution:** Upgrade to Node.js v20 or newer. The recommended way to manage Node versions is using [nvm (Node Version Manager)](https://github.com/nvm-sh/nvm).

1.  **Install nvm:**
    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    ```
    *(You will need to close and reopen your terminal after installation)*

2.  **Install and use Node.js v20:**
    ```bash
    nvm install 20
    nvm use 20
    ```

3.  **Verify the version:**
    ```bash
    node -v
    # Should output v20.x.x
    ```

4.  **Re-install dependencies and run:**
    ```bash
    npm install
    npm run dev
    ```

---

## Deployment to Static Hosting

This application is a static site and can be deployed to any static hosting provider.

1.  **Build the application:**
    ```bash
    npm run build
    ```
    This command compiles the app and places the optimized, static files into a `dist` directory.

2.  **Deploy the `dist` directory:**
    Upload the contents of the `dist` folder to your hosting provider of choice, such as:
    - Vercel
    - Netlify
    - GitHub Pages
    - AWS S3