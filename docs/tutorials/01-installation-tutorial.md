# Video Tutorial Script: Installation and Setup

**Duration:** 8-10 minutes
**Target Audience:** New users with basic technical knowledge
**Prerequisites:** Computer with internet access, basic command line familiarity

## Tutorial Overview

This tutorial guides viewers through the complete installation and setup process for YouTube MCP Extended, from initial download to successful first use with Claude Desktop.

---

## Script Structure

### Opening (30 seconds)

**[SCREEN: YouTube MCP Extended logo/title slide]**

**Narrator:** "Welcome to YouTube MCP Extended! In this tutorial, you'll learn how to install and configure this powerful tool that transforms Claude Desktop into your personal YouTube channel management assistant. By the end of this video, you'll have a fully working setup that can optimize your video metadata, schedule releases, and organize playlists automatically."

**[SCREEN: Show end result - Claude managing YouTube videos]**

"Let's get started!"

---

### Section 1: Prerequisites Check (1 minute)

**[SCREEN: Prerequisites checklist]**

**Narrator:** "Before we begin, let's make sure you have everything you need:"

**[SCREEN: Show nodejs.org download page]**

"First, you'll need Node.js version 20 or higher. If you don't have it, pause this video and download it from nodejs.org. Choose the LTS version for the best stability."

**[SCREEN: Terminal showing version check]**
```bash
node --version
npm --version
```

"Open your terminal or command prompt and run these commands to verify your installation. You should see version numbers like these."

**[SCREEN: Claude Desktop download page]**

"You'll also need Claude Desktop. Download it from claude.ai if you haven't already."

**[SCREEN: Google Cloud Console]**

"Finally, you'll need a Google account to set up API access. We'll walk through that process shortly."

---

### Section 2: Download and Installation (2 minutes)

**[SCREEN: GitHub repository page]**

**Narrator:** "Let's start by downloading YouTube MCP Extended. Go to the GitHub repository - I'll put the link in the description."

**[SCREEN: Terminal/command prompt]**

"Open your terminal and navigate to where you want to install the project. I'll use my Documents folder."

```bash
cd Documents
git clone https://github.com/denniswestermann/youtube_MetaData_MCP.git
cd youtube_MetaData_MCP
```

**[SCREEN: Installation progress]**

"Now let's install the dependencies. This might take a minute or two."

```bash
npm install
```

**[SCREEN: Build process]**

"Once that's done, we need to build the project:"

```bash
npm run build:basic
```

**[SCREEN: File explorer showing dist folder]**

"Great! You should now see a 'dist' folder with the compiled files. This means the installation was successful."

---

### Section 3: Google Cloud Setup (3 minutes)

**[SCREEN: Google Cloud Console homepage]**

**Narrator:** "Now for the most important part - setting up Google Cloud access. This allows the tool to communicate with YouTube's API."

**[SCREEN: Creating new project]**

"First, create a new project. Click 'Select a project' at the top, then 'New Project'. I'll call mine 'YouTube MCP Extended'."

**[SCREEN: APIs & Services navigation]**

"Once your project is created, we need to enable the YouTube API. Go to 'APIs & Services', then 'Library'."

**[SCREEN: YouTube Data API v3 search]**

"Search for 'YouTube Data API v3' and click on it, then click 'Enable'. This might take a moment."

**[SCREEN: OAuth consent screen setup]**

"Next, we need to set up the OAuth consent screen. Click 'OAuth consent screen' in the sidebar. Choose 'External' unless you have a Google Workspace account."

**[SCREEN: Filling out consent screen form]**

"Fill in the required fields:
- App name: YouTube MCP Extended
- User support email: your email
- Developer contact: your email again"

**[SCREEN: Adding scopes]**

"Click 'Save and Continue', then add scopes. We need YouTube access, so add these two scopes..."

**[SCREEN: Creating OAuth credentials]**

"Now let's create the credentials. Go to 'Credentials', click 'Create Credentials', then 'OAuth 2.0 Client IDs'."

**[SCREEN: OAuth client configuration]**

"Choose 'Web application' and add this exact redirect URI: http://localhost:3000/callback. This must be exact - no HTTPS, no trailing slash."

**[SCREEN: Copying credentials]**

"Save your Client ID and Client Secret - we'll need these in the next step. Don't share these with anyone!"

---

### Section 4: Configuration (1.5 minutes)

**[SCREEN: Back to terminal in project folder]**

**Narrator:** "Now let's configure the application with your Google credentials."

**[SCREEN: Creating .env file]**
```bash
cp .env.example .env
```

"Copy the example environment file to create your configuration."

**[SCREEN: Text editor showing .env file]**

"Open the .env file in your text editor and fill in your credentials:"

```env
YOUTUBE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your-client-secret-here
OAUTH_ENCRYPTION_SECRET=generate-a-strong-secret-here
```

**[SCREEN: Generating encryption secret]**

"For the encryption secret, use this command to generate a secure random string:"

```bash
openssl rand -base64 32
```

**[SCREEN: Validation command]**

"Let's verify your configuration:"

```bash
npm run validate:env
```

"You should see green checkmarks if everything is configured correctly."

---

### Section 5: Claude Desktop Configuration (1.5 minutes)

**[SCREEN: Finding Claude Desktop config file]**

**Narrator:** "Now we need to tell Claude Desktop about our new MCP server. The configuration file location depends on your operating system."

**[SCREEN: macOS file path]**
"On macOS: ~/Library/Application Support/Claude/claude_desktop_config.json"

**[SCREEN: Windows file path]**
"On Windows: %APPDATA%\Claude\claude_desktop_config.json"

**[SCREEN: Text editor showing config file]**

"Open this file and add our server configuration:"

```json
{
  "mcpServers": {
    "youtube-extended": {
      "command": "node",
      "args": ["./dist/index.js"],
      "cwd": "/absolute/path/to/youtube_MetaData_MCP"
    }
  }
}
```

**[SCREEN: Getting absolute path]**

"Make sure to use the absolute path to your project. You can get this by running 'pwd' in your project directory."

**[SCREEN: Saving and closing]**

"Save the file and completely quit Claude Desktop. Wait a few seconds, then restart it."

---

### Section 6: First Use and Testing (1 minute)

**[SCREEN: Claude Desktop interface]**

**Narrator:** "Let's test our installation! Open Claude Desktop and start a new conversation."

**[SCREEN: Typing in Claude]**

"Type: 'Start the YouTube OAuth flow'"

**[SCREEN: Claude's response with auth URL]**

"Claude should respond with an authorization URL. This means our MCP server is working!"

**[SCREEN: Browser OAuth flow]**

"Click the URL, sign in to Google, and grant permissions. Copy the code and state from the redirect URL."

**[SCREEN: Completing OAuth in Claude]**

"Back in Claude, complete the authentication with your code and state."

**[SCREEN: Testing video list]**

"Now test the connection: 'List my recent YouTube videos'"

**[SCREEN: Successful video list response]**

"Perfect! You should see your video data, which means everything is working correctly."

---

### Closing (30 seconds)

**[SCREEN: Success message/celebration graphic]**

**Narrator:** "Congratulations! You've successfully installed and configured YouTube MCP Extended. You can now use Claude Desktop to manage your YouTube channel with powerful automation features."

**[SCREEN: Next steps slide]**

"Check out our User Guide to learn about all the amazing features available, and don't forget to subscribe for more tutorials!"

**[SCREEN: Links and resources]**

"Links to all documentation and resources are in the description below. Happy YouTube managing!"

---

## Production Notes

### Visual Elements Needed

1. **Title Graphics:**
   - YouTube MCP Extended logo
   - Section transition slides
   - Step-by-step progress indicators

2. **Screen Recordings:**
   - Clean browser windows (clear history/bookmarks)
   - Terminal with readable font size
   - Zoomed-in text editor views
   - Slow cursor movements for easy following

3. **Callout Boxes:**
   - Important warnings (don't share credentials)
   - Key information highlights
   - Copy-paste reminders

### Audio Requirements

- **Clear narration** with consistent pacing
- **Background music** (subtle, non-distracting)
- **Sound effects** for successful completion steps
- **Pause points** where viewers might need extra time

### Accessibility Considerations

- **Closed captions** for all spoken content
- **High contrast** text and UI elements
- **Large font sizes** for code and configuration
- **Descriptive narration** of visual actions

### Interactive Elements

- **Timestamps** in description for easy navigation
- **Code snippets** in description for copy-paste
- **Link collection** for all referenced resources
- **Troubleshooting** quick-links for common issues

---

## Follow-up Content Ideas

1. **Basic Usage Tutorial** - First workflows
2. **Advanced Features** - Batch operations and automation
3. **Troubleshooting** - Common issues and solutions
4. **Optimization Tips** - Best practices for power users