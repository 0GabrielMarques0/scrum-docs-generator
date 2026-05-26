import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../database/init.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { aiService } from '../services/ai.service.js';

const router = Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `screen-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado. Use JPG, PNG, GIF ou WebP.'));
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  }
});

/**
 * @swagger
 * /api/screens/upload/{projectId}:
 *   post:
 *     summary: Upload screen images for a project
 *     tags: [Screens]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               names:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Screens uploaded successfully
 */
router.post('/upload/:projectId', upload.array('images', 20), async (req, res) => {
  try {
    const { projectId } = req.params;
    const files = req.files as Express.Multer.File[];
    const names = req.body.names ? (Array.isArray(req.body.names) ? req.body.names : [req.body.names]) : [];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    }

    // Check if project exists
    const [projects] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    );

    if (projects.length === 0) {
      // Clean up uploaded files
      files.forEach(file => fs.unlinkSync(file.path));
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    const uploadedScreens = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const screenName = names[i] || path.parse(file.originalname).name;
      const screenId = `screen-${Date.now()}-${i}`;

      await db.execute(
        `INSERT INTO project_screens (id, project_id, screen_id, screen_name, image_path, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [screenId, projectId, screenId, screenName, file.filename]
      );

      uploadedScreens.push({
        id: screenId,
        name: screenName,
        imagePath: file.filename,
        status: 'pending'
      });
    }

    res.status(201).json({ 
      message: `${files.length} tela(s) enviada(s) com sucesso`,
      screens: uploadedScreens 
    });
  } catch (error: any) {
    console.error('Error uploading screens:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao fazer upload das imagens' });
  }
});

/**
 * @swagger
 * /api/screens/{projectId}:
 *   get:
 *     summary: Get all screens for a project
 *     tags: [Screens]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of screens
 */
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const [screens] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM project_screens WHERE project_id = ? ORDER BY screen_name',
      [projectId]
    );

    res.json({ screens });
  } catch (error: any) {
    console.error('Error getting screens:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao obter telas' });
  }
});

/**
 * @swagger
 * /api/screens/{screenId}/image:
 *   get:
 *     summary: Get screen image
 *     tags: [Screens]
 *     parameters:
 *       - in: path
 *         name: screenId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Image file
 */
router.get('/:screenId/image', async (req, res) => {
  try {
    const { screenId } = req.params;

    const [screens] = await db.execute<RowDataPacket[]>(
      'SELECT image_path FROM project_screens WHERE id = ? OR screen_id = ?',
      [screenId, screenId]
    );

    if (screens.length === 0) {
      return res.status(404).json({ error: 'Tela não encontrada' });
    }

    const imagePath = path.join(process.cwd(), 'uploads', screens[0].image_path);
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Imagem não encontrada' });
    }

    res.sendFile(imagePath);
  } catch (error: any) {
    console.error('Error getting screen image:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao obter imagem' });
  }
});

/**
 * @swagger
 * /api/screens/{screenId}:
 *   put:
 *     summary: Update screen name
 *     tags: [Screens]
 */
router.put('/:screenId', async (req, res) => {
  try {
    const { screenId } = req.params;
    const { name } = req.body;

    await db.execute(
      'UPDATE project_screens SET screen_name = ? WHERE id = ? OR screen_id = ?',
      [name, screenId, screenId]
    );

    res.json({ message: 'Tela atualizada com sucesso' });
  } catch (error: any) {
    console.error('Error updating screen:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao atualizar tela' });
  }
});

/**
 * @swagger
 * /api/screens/{screenId}:
 *   delete:
 *     summary: Delete a screen
 *     tags: [Screens]
 */
router.delete('/:screenId', async (req, res) => {
  try {
    const { screenId } = req.params;

    // Get image path before deleting
    const [screens] = await db.execute<RowDataPacket[]>(
      'SELECT image_path FROM project_screens WHERE id = ? OR screen_id = ?',
      [screenId, screenId]
    );

    if (screens.length > 0 && screens[0].image_path) {
      const imagePath = path.join(process.cwd(), 'uploads', screens[0].image_path);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await db.execute(
      'DELETE FROM project_screens WHERE id = ? OR screen_id = ?',
      [screenId, screenId]
    );

    res.json({ message: 'Tela removida com sucesso' });
  } catch (error: any) {
    console.error('Error deleting screen:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao remover tela' });
  }
});

/**
 * @swagger
 * /api/screens/{screenId}/analyze:
 *   post:
 *     summary: Analyze a screen image with AI and generate requirements
 *     tags: [Screens]
 */
router.post('/:screenId/analyze', async (req, res) => {
  try {
    const { screenId } = req.params;
    const { projectName } = req.body;

    // Get screen info
    const [screens] = await db.execute<RowDataPacket[]>(
      'SELECT ps.*, p.name as project_name FROM project_screens ps JOIN projects p ON ps.project_id = p.id WHERE ps.id = ? OR ps.screen_id = ?',
      [screenId, screenId]
    );

    if (screens.length === 0) {
      return res.status(404).json({ error: 'Tela não encontrada' });
    }

    const screen = screens[0];
    const imagePath = path.join(process.cwd(), 'uploads', screen.image_path);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Imagem não encontrada' });
    }

    // Read image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = screen.image_path.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // Analyze with AI Vision
    const requirements = await aiService.analyzeScreenImage(
      screen.screen_name,
      base64Image,
      mimeType,
      projectName || screen.project_name
    );

    // Update screen status
    await db.execute(
      'UPDATE project_screens SET status = ? WHERE id = ? OR screen_id = ?',
      ['analyzed', screenId, screenId]
    );

    res.json({ 
      screenId,
      screenName: screen.screen_name,
      requirements 
    });
  } catch (error: any) {
    console.error('Error analyzing screen:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao analisar tela' });
  }
});

/**
 * @swagger
 * /api/screens/analyze-images:
 *   post:
 *     summary: Analyze multiple images with AI (without saving to disk)
 *     tags: [Screens]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectId:
 *                 type: string
 *               screenName:
 *                 type: string
 *               projectName:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     base64:
 *                       type: string
 *                     mimeType:
 *                       type: string
 *     responses:
 *       200:
 *         description: Requirements generated successfully
 */
router.post('/analyze-images', async (req, res) => {
  try {
    const { projectId, screenName, projectName, images } = req.body;

    if (!screenName || !images || images.length === 0) {
      return res.status(400).json({ error: 'Nome da tela e imagens são obrigatórios' });
    }

    // Analyze all images with AI (images are not saved to disk)
    const requirements = await aiService.analyzeMultipleScreenImages(
      screenName,
      images,
      projectName || 'Projeto'
    );

    res.json({ 
      screenName,
      requirements 
    });
  } catch (error: any) {
    console.error('Error analyzing images:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao analisar imagens' });
  }
});

export default router;
