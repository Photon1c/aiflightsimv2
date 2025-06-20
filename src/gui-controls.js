export function setupControls(config, onUpdate) {
  const keys = {};
  document.addEventListener('keydown', e => keys[e.code] = true);
  document.addEventListener('keyup', e => keys[e.code] = false);

  setInterval(() => {
    const delta = {
      pitch: 0,
      yaw: 0,
      roll: 0,
      throttle: 0
    };

    if (keys['ArrowUp']) delta.pitch -= config.pitchSpeed;
    if (keys['ArrowDown']) delta.pitch += config.pitchSpeed;
    if (keys['ArrowLeft']) delta.yaw -= config.yawSpeed;
    if (keys['ArrowRight']) delta.yaw += config.yawSpeed;
    if (keys['KeyA']) delta.roll += config.rollSpeed;
    if (keys['KeyD']) delta.roll -= config.rollSpeed;
    if (keys['KeyW']) delta.throttle += config.throttleIncrement;
    if (keys['KeyS']) delta.throttle -= config.throttleIncrement;

    onUpdate(delta);
  }, 100);
}

export function createPIDGui(aircraft) {
  // Create container for PID controls
  const container = document.createElement('div');
  container.id = 'pid-controls';
  container.style.position = 'absolute';
  container.style.right = '20px';
  container.style.top = '60px';
  container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  container.style.padding = '10px';
  container.style.borderRadius = '5px';
  container.style.color = 'white';
  container.style.fontFamily = 'monospace';

  // Helper function to create sliders
  function createSlider(id, label, min, max, step, value) {
    const div = document.createElement('div');
    div.style.marginBottom = '10px';
    
    const labelElem = document.createElement('label');
    labelElem.htmlFor = id;
    labelElem.textContent = label;
    labelElem.style.display = 'block';
    labelElem.style.marginBottom = '5px';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = id;
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.style.width = '100%';
    
    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = value;
    valueDisplay.style.marginLeft = '10px';
    
    slider.oninput = () => {
      valueDisplay.textContent = slider.value;
    };
    
    div.appendChild(labelElem);
    div.appendChild(slider);
    div.appendChild(valueDisplay);
    return div;
  }

  // Create PID control sliders
  const controls = [
    { id: 'kp-altitude', label: 'Altitude P', min: 0, max: 2, step: 0.1, value: 0.5 },
    { id: 'ki-altitude', label: 'Altitude I', min: 0, max: 1, step: 0.05, value: 0.1 },
    { id: 'kd-altitude', label: 'Altitude D', min: 0, max: 2, step: 0.1, value: 0.3 },
    { id: 'kp-attitude', label: 'Attitude P', min: 0, max: 2, step: 0.1, value: 0.5 },
    { id: 'ki-attitude', label: 'Attitude I', min: 0, max: 1, step: 0.05, value: 0.1 },
    { id: 'kd-attitude', label: 'Attitude D', min: 0, max: 2, step: 0.1, value: 0.3 }
  ];

  controls.forEach(control => {
    const slider = createSlider(
      control.id,
      control.label,
      control.min,
      control.max,
      control.step,
      control.value
    );
    container.appendChild(slider);
  });

  // Add event listeners to update PID values
  function bindSlider(id, callback) {
    const slider = document.getElementById(id);
    if (slider) {
      slider.addEventListener('input', () => {
        callback(parseFloat(slider.value));
      });
    }
  }

  // Bind sliders to aircraft PID controllers
  if (aircraft.altitudePID) {
    bindSlider('kp-altitude', value => aircraft.altitudePID.kp = value);
    bindSlider('ki-altitude', value => aircraft.altitudePID.ki = value);
    bindSlider('kd-altitude', value => aircraft.altitudePID.kd = value);
  }

  if (aircraft.attitudePID) {
    bindSlider('kp-attitude', value => aircraft.attitudePID.kp = value);
    bindSlider('ki-attitude', value => aircraft.attitudePID.ki = value);
    bindSlider('kd-attitude', value => aircraft.attitudePID.kd = value);
  }

  document.body.appendChild(container);
  return container;
}