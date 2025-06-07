import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';

export const prerender = false;

const jsonPath = path.resolve(process.cwd(), 'data', 'guestbook.json');

async function readEntries() {
  try {
    const data = await fs.readFile(jsonPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeEntries(entries) {
  await fs.writeFile(jsonPath, JSON.stringify(entries, null, 2), 'utf-8');
}

export const GET: APIRoute = async () => {
  try {
    const entries = await readEntries();
    // Tri décroissant par timestamp
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    // On retire le champ email avant d'envoyer au client
    const publicEntries = entries.map(({email, ...rest}) => rest);
    return new Response(JSON.stringify({ success: true, entries: publicEntries }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erreur lors de la lecture des entrées:', error);
    return new Response(JSON.stringify({ success: false, error: 'Erreur serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get('content-type') !== 'application/json') {
    return new Response(JSON.stringify({ success: false, error: 'Type de contenu invalide' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { name, email, message } = body;

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ success: false, error: 'Nom, email et message requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!email.includes('@') || !email.includes('.')) {
      return new Response(JSON.stringify({ success: false, error: 'Format d\'email invalide' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const entries = await readEntries();
    const newEntry = {
      id: entries.length > 0 ? entries[entries.length - 1].id + 1 : 1,
      name,
      email,
      message,
      timestamp: new Date().toISOString(),
    };
    entries.push(newEntry);
    await writeEntries(entries);

    return new Response(JSON.stringify({ success: true, entry: newEntry }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erreur lors de l\'insertion:', error);
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ success: false, error: 'Payload JSON invalide' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: false, error: 'Erreur serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
