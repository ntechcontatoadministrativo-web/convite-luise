// Lista de convidados (só o admin vê) e a busca do nome que a pessoa digitou.

const CONVIDADOS = [
  'Thais', 'Marcelo', 'Renato', 'Sachie', 'Akemi', 'Henrique', 'Maria Clara', 'Maria Eduarda', 'Gabi', 'Laura',
  'Mateus', 'Quezia', 'Mari', 'Enzo', 'Ricardinho', 'Andee', 'Lissa', 'Gio', 'Felipe', 'Felipe Preto',
  'Sofia', 'Poli', 'Ricardo', 'Lumi', 'Bemicio', 'Maria Helena', 'Eliel', 'Paula', 'Vivian', 'Klautau',
].sort((a, b) => a.localeCompare(b, 'pt-BR'));

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

// apelidos e grafias comuns -> como está na lista
const APELIDOS = {
  gabriela: 'Gabi', gabriel: 'Gabi', gabriella: 'Gabi', giovana: 'Gio', giovanna: 'Gio', giovanni: 'Gio',
  matheus: 'Mateus', thais: 'Thais', tais: 'Thais', sophia: 'Sofia', quesia: 'Quezia', queziah: 'Quezia',
  mariana: 'Mari', marianna: 'Mari', paulinha: 'Paula', polyana: 'Poli', poliana: 'Poli', polly: 'Poli', poly: 'Poli',
  vivi: 'Vivian', viviane: 'Vivian', vivianne: 'Vivian',
};

function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Devolve o nome da lista que corresponde ao que foi digitado, ou null se não der para ter certeza.
function encontraConvidado(digitado) {
  const t = norm(digitado);
  if (!t) return null;
  const palavras = t.split(' ');

  // 1) igual, ou o nome da lista é o começo do que foi digitado ("Laura Souza" -> Laura).
  //    Fica com o mais longo: "Felipe Preto" ganha de "Felipe".
  const porPrefixo = CONVIDADOS
    .filter(c => { const n = norm(c); return t === n || t.startsWith(n + ' '); })
    .sort((a, b) => b.length - a.length);
  if (porPrefixo.length) return porPrefixo[0];

  // 2) apelido conhecido no primeiro nome
  if (APELIDOS[palavras[0]]) return APELIDOS[palavras[0]];

  // 3) nome composto da lista aparece em qualquer lugar ("Ana Maria Clara")
  const composto = CONVIDADOS.filter(c => c.includes(' ') && (' ' + t + ' ').includes(' ' + norm(c) + ' '));
  if (composto.length === 1) return composto[0];

  // "Maria" sozinho pode ser Maria Clara, Eduarda ou Helena: melhor não adivinhar
  if (CONVIDADOS.some(c => c.includes(' ') && norm(c).split(' ')[0] === palavras[0])) return null;

  // 4) pequeno erro de digitação no primeiro nome (ou nos dois primeiros, para nomes compostos)
  const candidatos = CONVIDADOS.filter(c => {
    const n = norm(c), partes = n.split(' ').length;
    const trecho = palavras.slice(0, partes).join(' ');
    const tol = n.length >= 7 ? 2 : n.length >= 4 ? 1 : 0;
    return tol > 0 && distancia(trecho, n) <= tol;
  });
  if (candidatos.length === 1) return candidatos[0];
  return null;
}

module.exports = { CONVIDADOS, encontraConvidado, norm };
