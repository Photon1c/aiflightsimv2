export function createLogoAnimation() {
    return new Promise((resolve) => {
        // Create main container with centered flex
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #000000;
            z-index: 3000;
        `;

        // Create frame container for clip animation
        const frameContainer = document.createElement('div');
        frameContainer.style.cssText = `
            position: relative;
            width: 1200px;
            height: 800px;
            display: flex;
            justify-content: center;
            align-items: center;
            transform: scale(0.8);
            opacity: 0;
            transition: transform 1.2s cubic-bezier(0.4, 0, 0.2, 1),
                        opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        // Create geometric frame elements
        const createFrameElement = (styles) => {
            const element = document.createElement('div');
            element.style.cssText = `
                position: absolute;
                background-color: #ffffff;
                opacity: 0;
                transform: scale(0.95);
                transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                ${styles}
            `;
            return element;
        };

        // Add frame elements
        const topFrame = createFrameElement('top: 0; left: 20%; width: 60%; height: 2px;');
        const bottomFrame = createFrameElement('bottom: 0; left: 20%; width: 60%; height: 2px;');
        const leftFrame = createFrameElement('left: 0; top: 20%; width: 2px; height: 60%;');
        const rightFrame = createFrameElement('right: 0; top: 20%; width: 2px; height: 60%;');

        // Create logo container with clip-path animation
        const logoContainer = document.createElement('div');
        logoContainer.style.cssText = `
            position: relative;
            width: 1000px;
            height: 600px;
            display: flex;
            justify-content: center;
            align-items: center;
            clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%);
            transition: clip-path 1.2s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        // Create and style the logo
        const logo = document.createElement('img');
        logo.src = './media/CBTTOL.png';
        logo.style.cssText = `
            max-width: 150%;
            max-height: 150%;
            filter: brightness(0);
            transition: filter 1.5s cubic-bezier(0.4, 0, 0.2, 1);
            object-fit: contain;
        `;

        // Assemble the elements
        logoContainer.appendChild(logo);
        frameContainer.appendChild(topFrame);
        frameContainer.appendChild(bottomFrame);
        frameContainer.appendChild(leftFrame);
        frameContainer.appendChild(rightFrame);
        frameContainer.appendChild(logoContainer);
        container.appendChild(frameContainer);
        document.body.appendChild(container);

        // Animation sequence
        requestAnimationFrame(() => {
            // Frame container fade in
            frameContainer.style.opacity = '1';
            frameContainer.style.transform = 'scale(1)';

            // Delayed frame elements animation
            setTimeout(() => {
                [topFrame, bottomFrame, leftFrame, rightFrame].forEach(frame => {
                    frame.style.opacity = '0.8';
                    frame.style.transform = 'scale(1)';
                });
            }, 200);

            // Logo reveal animation
            setTimeout(() => {
                logoContainer.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
                logo.style.filter = 'brightness(1)';
            }, 400);
        });

        // Exit animation sequence
        setTimeout(() => {
            // Reverse frame animations
            [topFrame, bottomFrame, leftFrame, rightFrame].forEach(frame => {
                frame.style.opacity = '0';
                frame.style.transform = 'scale(1.1)';
            });

            // Logo fade out with bright flash
            logo.style.filter = 'brightness(1.5)';
            logoContainer.style.clipPath = 'polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)';

            // Container scale and fade
            frameContainer.style.opacity = '0';
            frameContainer.style.transform = 'scale(1.2)';
        }, 2500);

        // Clean up and resolve
        setTimeout(() => {
            container.remove();
            resolve();
        }, 3100);
    });
}

// Add CSS to document head for smoother animations
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style); 