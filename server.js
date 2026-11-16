const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'yuri fofinho';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && process.env.PGSSL !== 'off'
    ? { rejectUnauthorized: false } : false,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS confirmacoes (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      telefone TEXT,
      vai BOOLEAN NOT NULL,
      pessoas INTEGER NOT NULL DEFAULT 1,
      mensagem TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
}

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const limpa = (s, max) => String(s ?? '').trim().slice(0, max);

app.get('/api/evento', (req, res) => {
  res.json({ local: process.env.EVENT_LOCAL || 'Passagem Emílio Martins, 92 — entre Chaco e Jabatiteua', mapa: process.env.EVENT_MAPA || 'https://www.google.com/maps/search/?api=1&query=Passagem+Emilio+Martins+92+Marco+Belem+PA' });
});

// lista pública: só nome e quantidade de quem confirmou
app.get('/api/confirmados', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT nome, pessoas FROM confirmacoes WHERE vai = true ORDER BY criado_em ASC');
    const total = rows.reduce((s, r) => s + r.pessoas, 0);
    res.json({ total, nomes: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Não foi possível carregar a lista agora.' });
  }
});

app.post('/api/confirmar', async (req, res) => {
  const nome = limpa(req.body.nome, 80);
  const telefone = limpa(req.body.telefone, 30);
  const mensagem = limpa(req.body.mensagem, 300);
  const vai = req.body.vai === true || req.body.vai === 'sim';
  let pessoas = parseInt(req.body.pessoas, 10);
  if (!Number.isFinite(pessoas) || pessoas < 1) pessoas = 1;
  if (pessoas > 10) pessoas = 10;
  if (!vai) pessoas = 0;
  if (nome.length < 2) return res.status(400).json({ erro: 'Escreva seu nome para confirmar.' });

  try {
    // mesmo nome responde de novo: atualiza em vez de duplicar
    const existe = await pool.query('SELECT id FROM confirmacoes WHERE lower(nome) = lower($1)', [nome]);
    if (existe.rows.length) {
      await pool.query(
        'UPDATE confirmacoes SET telefone=$2, vai=$3, pessoas=$4, mensagem=$5, criado_em=now() WHERE id=$1',
        [existe.rows[0].id, telefone, vai, pessoas, mensagem]);
    } else {
      await pool.query(
        'INSERT INTO confirmacoes (nome, telefone, vai, pessoas, mensagem) VALUES ($1,$2,$3,$4,$5)',
        [nome, telefone, vai, pessoas, mensagem]);
    }
    res.json({ ok: true, atualizado: existe.rows.length > 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Não conseguimos salvar sua resposta. Tente de novo em instantes.' });
  }
});

function exigeAdmin(req, res, next) {
  if ((req.query.chave || req.get('x-chave')) !== ADMIN_KEY) return res.status(401).json({ erro: 'Chave inválida.' });
  next();
}

app.get('/api/admin/lista', exigeAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM confirmacoes ORDER BY criado_em DESC');
  res.json(rows);
});

app.delete('/api/admin/:id', exigeAdmin, async (req, res) => {
  await pool.query('DELETE FROM confirmacoes WHERE id = $1', [parseInt(req.params.id, 10)]);
  res.json({ ok: true });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

init()
  .then(() => app.listen(PORT, () => console.log('Convite no ar na porta ' + PORT)))
  .catch((e) => { console.error('Falha ao iniciar banco:', e); process.exit(1); });
