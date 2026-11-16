const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const { CONVIDADOS, encontraConvidado } = require('./convidados');

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
  await pool.query('ALTER TABLE confirmacoes ADD COLUMN IF NOT EXISTS convidado TEXT');
}

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const limpa = (s, max) => String(s ?? '').trim().slice(0, max);


app.get('/api/evento', (req, res) => {
  res.json({ local: process.env.EVENT_LOCAL || 'Passagem Emílio Martins, 92 — entre Chaco e Jabatiteua', mapa: process.env.EVENT_MAPA || 'https://www.google.com/maps/search/?api=1&query=Passagem+Emilio+Martins+92+Marco+Belem+PA' });
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
  const convidado = encontraConvidado(nome);

  try {
    // a mesma pessoa responde de novo: atualiza em vez de duplicar
    const existe = convidado
      ? await pool.query('SELECT id FROM confirmacoes WHERE convidado = $1', [convidado])
      : await pool.query('SELECT id FROM confirmacoes WHERE lower(nome) = lower($1)', [nome]);
    if (existe.rows.length) {
      await pool.query(
        'UPDATE confirmacoes SET nome=$2, telefone=$3, vai=$4, pessoas=$5, mensagem=$6, convidado=$7, criado_em=now() WHERE id=$1',
        [existe.rows[0].id, nome, telefone, vai, pessoas, mensagem, convidado]);
    } else {
      await pool.query(
        'INSERT INTO confirmacoes (nome, telefone, vai, pessoas, mensagem, convidado) VALUES ($1,$2,$3,$4,$5,$6)',
        [nome, telefone, vai, pessoas, mensagem, convidado]);
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
  // cada convidado da lista com a resposta que foi reconhecida para ele
  const lista = CONVIDADOS.map(c => {
    const r = rows.find(x => x.convidado === c);
    return { convidado: c, status: !r ? 'pendente' : r.vai ? 'vai' : 'nao', pessoas: r && r.vai ? r.pessoas : 0, digitou: r ? r.nome : '' };
  });
  res.json({ lista, respostas: rows, foraDaLista: rows.filter(r => !r.convidado) });
});

app.delete('/api/admin/:id', exigeAdmin, async (req, res) => {
  await pool.query('DELETE FROM confirmacoes WHERE id = $1', [parseInt(req.params.id, 10)]);
  res.json({ ok: true });
});

// o admin liga uma resposta não reconhecida a um nome da lista (ou desfaz com convidado vazio)
app.patch('/api/admin/:id', exigeAdmin, async (req, res) => {
  const convidado = CONVIDADOS.includes(req.body.convidado) ? req.body.convidado : null;
  if (convidado) await pool.query('UPDATE confirmacoes SET convidado = NULL WHERE convidado = $1', [convidado]);
  await pool.query('UPDATE confirmacoes SET convidado = $2 WHERE id = $1', [parseInt(req.params.id, 10), convidado]);
  res.json({ ok: true });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

init()
  .then(() => app.listen(PORT, () => console.log('Convite no ar na porta ' + PORT)))
  .catch((e) => { console.error('Falha ao iniciar banco:', e); process.exit(1); });
