import { Router } from 'express';
import { Octokit } from 'octokit';
import { db } from '../database/init.js';

const router = Router();

/**
 * POST /api/github/commit
 * Create or update files in a GitHub repository
 */
router.post('/commit', async (req, res) => {
  try {
    const { 
      token,
      owner, 
      repo, 
      branch = 'main',
      files,
      message 
    } = req.body;
    
    if (!owner || !repo || !files || !Array.isArray(files)) {
      return res.status(400).json({ 
        error: 'owner, repo e files (array) são obrigatórios' 
      });
    }
    
    const githubToken = token || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return res.status(400).json({ error: 'Token do GitHub não configurado' });
    }
    
    const octokit = new Octokit({ auth: githubToken });
    
    const results = [];
    
    for (const file of files) {
      try {
        // Check if file exists
        let sha: string | undefined;
        try {
          const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: file.path,
            ref: branch,
          });
          if ('sha' in data) {
            sha = data.sha;
          }
        } catch (e) {
          // File doesn't exist, that's ok
        }
        
        // Create or update file
        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: file.path,
          message: message || `docs: add ${file.path}`,
          content: Buffer.from(file.content).toString('base64'),
          branch,
          sha,
        });
        
        results.push({
          path: file.path,
          success: true,
          action: sha ? 'updated' : 'created',
        });
      } catch (error: any) {
        results.push({
          path: file.path,
          success: false,
          error: error.message,
        });
      }
    }
    
    res.json({ results });
  } catch (error: any) {
    console.error('Error committing to GitHub:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao enviar para GitHub' });
  }
});

/**
 * GET /api/github/repos
 * List user repositories
 */
router.get('/repos', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || process.env.GITHUB_TOKEN;
    
    if (!token) {
      return res.status(400).json({ error: 'Token do GitHub não configurado' });
    }
    
    const octokit = new Octokit({ auth: token });
    
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    });
    
    res.json({
      repos: data.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        defaultBranch: repo.default_branch,
      })),
    });
  } catch (error: any) {
    console.error('Error listing repos:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao listar repositórios' });
  }
});

export const githubRoutes = router;
