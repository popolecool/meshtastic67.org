import type { APIRoute } from 'astro';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export const prerender = false;

const dbPath = './data/guestbook.db'; // Adjusted path to be relative to the project root

// Function to open the database connection
async function openDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const db = await openDb();
    const entries = await db.all('SELECT * FROM entries ORDER BY timestamp DESC');
    await db.close();

    return new Response(JSON.stringify({ success: true, entries }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    return new Response(JSON.stringify({ success: false, error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get('content-type') !== 'application/json') {
    return new Response(JSON.stringify({ success: false, error: 'Invalid content type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { name, email, message } = body;

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ success: false, error: 'Name, email, and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!email.includes('@') || !email.includes('.')) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = await openDb();
    const result = await db.run(
      'INSERT INTO entries (name, email, message) VALUES (?, ?, ?)',
      name,
      email,
      message
    );

    if (!result.lastID) {
      await db.close();
      return new Response(JSON.stringify({ success: false, error: 'Failed to insert entry' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newEntry = await db.get('SELECT * FROM entries WHERE id = ?', result.lastID);
    await db.close();

    return new Response(JSON.stringify({ success: true, entry: newEntry }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error inserting entry:', error);
    // Check if it's a parsing error or other client error
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: false, error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
