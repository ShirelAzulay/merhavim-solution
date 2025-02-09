const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const SETTINGS_FILE_PATH = path.join(__dirname, './settings.json');

app.post('/update-settings', async (req, res) => {
  try {
    const { newId } = req.body;
    const settingsData = await fs.readFile(SETTINGS_FILE_PATH, 'utf8');
    const settings = JSON.parse(settingsData);
    
    if (!settings.allowedNumbers.includes(Number(newId))) {
      settings.allowedNumbers.push(Number(newId));
      await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2));
      console.log(`Added ID ${newId} to settings.json`);
    }
    
    res.json({ success: true, message: `Updated settings with ID ${newId}` });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/delete-patient', async (req, res) => {
  try {
    const { patientId } = req.body;
    
    const settingsData = await fs.readFile(SETTINGS_FILE_PATH, 'utf8');
    const settings = JSON.parse(settingsData);
    
    settings.allowedNumbers = settings.allowedNumbers.filter(id => id !== patientId);
    
    await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2));
    
    console.log(`Removed patient ID ${patientId} from settings`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in delete-patient:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/settings', async (req, res) => {
  try {
    const settingsData = await fs.readFile(SETTINGS_FILE_PATH, 'utf8');
    const settings = JSON.parse(settingsData);
    res.json(settings);
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Settings server running on port ${PORT}`);
}); 