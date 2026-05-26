import { Router } from 'express';
import { db } from '../database/init.js';
import { RowDataPacket } from 'mysql2';

const router = Router();

/**
 * @swagger
 * /api/requirements/{id}:
 *   get:
 *     summary: Get a specific requirements document
 *     tags: [Requirements]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Requirements document
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM requirements WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Requisitos não encontrados' });
    }
    
    const row = rows[0];
    
    res.json({
      id: row.id,
      screenName: row.screen_name,
      platform: row.platform,
      markdown: row.markdown,
      requirements: row.json_data ? JSON.parse(row.json_data) : null,
      createdAt: row.created_at,
    });
  } catch (error: any) {
    console.error('Error getting requirements:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao obter requisitos' });
  }
});

/**
 * @swagger
 * /api/requirements:
 *   get:
 *     summary: List all requirements documents
 *     tags: [Requirements]
 *     responses:
 *       200:
 *         description: List of requirements
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id, screen_name, file_key, platform, created_at 
       FROM requirements 
       ORDER BY created_at DESC`
    );
    
    res.json({ requirements: rows });
  } catch (error: any) {
    console.error('Error listing requirements:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao listar requisitos' });
  }
});

export const requirementsRoutes = router;
