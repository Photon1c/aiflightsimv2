// AI Control and Feedback System
export class AISystem {
    constructor() {
        this.feedbackPanel = null;
        this.greetingMessages = [
            "Welcome to AI Flight Simulator!",
            "I'll be your co-pilot today.",
            "Let's explore the world together.",
            "Use WASD/Arrow keys to control the aircraft.",
            "Type commands in the input field below.",
            "Try 'fly around the globe' command!"
        ];
        this.currentMessageIndex = 0;
        this.messageInterval = null;
        this.backendUrl = 'http://localhost:3000';
        this.isConnected = false;
    }

    initialize(feedbackPanel) {
        this.feedbackPanel = feedbackPanel;
        this.startGreeting();
        this.showAIControls();
        this.setupInputField();
        this.connectToBackend();
    }

    async connectToBackend() {
        try {
            const response = await fetch(`${this.backendUrl}/status`);
            if (response.ok) {
                this.isConnected = true;
                this.updateFeedback({
                    message: "✅ Connected to AI backend",
                    controls: {}
                });
            }
        } catch (error) {
            console.warn('AI backend not available:', error);
            this.updateFeedback({
                message: "⚠️ AI backend not connected. Some features may be limited.",
                controls: {}
            });
        }
    }

    setupInputField() {
        if (!this.feedbackPanel) return;

        // Create input container
        const inputContainer = document.createElement('div');
        inputContainer.id = 'ai-input-container';

        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'ai-input';
        input.placeholder = 'Type your command here...';

        // Create send button
        const sendButton = document.createElement('button');
        sendButton.id = 'ai-send-button';
        sendButton.textContent = 'Send';

        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.id = 'ai-input-toggle';
        toggleButton.innerHTML = '⌨';
        toggleButton.title = 'Toggle command input';
        
        let isCollapsed = false;
        toggleButton.onclick = () => {
            isCollapsed = !isCollapsed;
            inputContainer.classList.toggle('collapsed', isCollapsed);
            toggleButton.innerHTML = isCollapsed ? '⌨' : '×';
        };

        // Add event listeners
        const sendCommand = async () => {
            const command = input.value.trim();
            if (!command) return;

            // Clear input
            input.value = '';

            // Show user's command in feedback
            this.appendFeedback({
                message: `You: ${command}`,
                isUser: true
            });

            if (!this.isConnected) {
                this.appendFeedback({
                    message: "⚠️ AI backend not connected. Please try again later.",
                    isError: true
                });
                return;
            }

            try {
                const response = await fetch(`${this.backendUrl}/command`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ command })
                });

                if (!response.ok) throw new Error('Failed to send command');

                const data = await response.json();
                this.appendFeedback({
                    message: `AI: ${data.message}`,
                    controls: data.controls || {}
                });
            } catch (error) {
                console.error('Error sending command:', error);
                this.appendFeedback({
                    message: "⚠️ Error processing command. Please try again.",
                    isError: true
                });
            }
        };

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendCommand();
        });
        sendButton.addEventListener('click', sendCommand);

        // Add elements to container
        inputContainer.appendChild(input);
        inputContainer.appendChild(sendButton);
        this.feedbackPanel.appendChild(inputContainer);
        inputContainer.appendChild(toggleButton);
    }

    appendFeedback(data) {
        if (!this.feedbackPanel) return;

        const messagesSection = this.feedbackPanel.querySelector('.feedback-messages');
        if (!messagesSection) return;

        // Create new feedback element
        const feedbackElement = document.createElement('div');
        feedbackElement.style.marginBottom = '10px';

        if (data.isUser) {
            feedbackElement.style.color = '#8ff';
            feedbackElement.style.textAlign = 'right';
        } else if (data.isError) {
            feedbackElement.style.color = '#ff8f8f';
        }

        feedbackElement.innerHTML = data.message;
        messagesSection.appendChild(feedbackElement);
        messagesSection.scrollTop = messagesSection.scrollHeight;
    }

    startGreeting() {
        if (!this.feedbackPanel) return;
        
        // Clear any existing interval
        if (this.messageInterval) {
            clearInterval(this.messageInterval);
        }

        // Display greeting messages in sequence
        this.messageInterval = setInterval(() => {
            if (this.currentMessageIndex < this.greetingMessages.length) {
                this.updateFeedback({
                    message: this.greetingMessages[this.currentMessageIndex],
                    controls: {
                        throttle: 0,
                        pitch: 0,
                        roll: 0,
                        yaw: 0
                    }
                });
                this.currentMessageIndex++;
            } else {
                clearInterval(this.messageInterval);
                this.messageInterval = null;
            }
        }, 2000); // Show each message for 2 seconds
    }

    updateFeedback(data) {
        if (!this.feedbackPanel) return;

        // Create or update messages section
        let messagesSection = this.feedbackPanel.querySelector('.feedback-messages');
        if (!messagesSection) {
            messagesSection = document.createElement('div');
            messagesSection.className = 'feedback-messages';
            this.feedbackPanel.insertBefore(messagesSection, this.feedbackPanel.querySelector('#ai-input-container'));
        }

        // Add new message
        if (data.message) {
            const messageElement = document.createElement('div');
            messageElement.style.marginBottom = '10px';
            messageElement.innerHTML = `
                <div style="color: white;">
                    ${data.message}
                </div>
            `;
            messagesSection.appendChild(messageElement);
            messagesSection.scrollTop = messagesSection.scrollHeight;
        }
    }

    showAIControls() {
        // Find and click the AI controls tab if it exists
        const aiTab = document.querySelector('[data-tab="ai"]');
        if (aiTab) {
            aiTab.click();
        }
    }

    processFlightData(aircraft) {
        // This method will be updated to handle AI flight controls
        const controls = {
            throttle: 0,
            pitch: 0,
            roll: 0,
            yaw: 0
        };

        return controls;
    }
}

// Create and export a singleton instance
export const aiSystem = new AISystem(); 