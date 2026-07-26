const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 8080;
const DATI_FILE = path.join(__dirname, 'dati_viaggi.json');

function leggiJSON(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function ordinaViaggi(viaggi) {
    return viaggi.sort((a, b) => {
        const dateA = new Date(`${a.data}T${a.oraPartenza || '00:00'}`);
        const dateB = new Date(`${b.data}T${b.oraPartenza || '00:00'}`);
        return dateA - dateB;
    });
}

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// GET - Leggi tutti i viaggi
app.get('/api/viaggi', (req, res) => {
    try {
        const dati = leggiJSON(DATI_FILE);
        res.json(ordinaViaggi(dati));
    } catch (error) {
        console.error('GET /api/viaggi error:', error);
        res.status(500).json({ error: 'Errore nella lettura dei dati' });
    }
});

// POST - Aggiungi un nuovo viaggio
app.post('/api/viaggi', (req, res) => {
    try {
        const dati = leggiJSON(DATI_FILE);
        const kmIniziali = parseFloat(req.body.kmIniziali);
        const kmFinaliInput = req.body.kmFinali !== undefined && req.body.kmFinali !== null ? parseFloat(req.body.kmFinali) : null;
        const kmTotaliInput = req.body.kmTotali !== undefined && req.body.kmTotali !== null ? parseFloat(req.body.kmTotali) : null;

        if (!req.body.data || !req.body.oraPartenza || !req.body.da || !req.body.a || !req.body.tipoPercorso) {
            return res.status(400).json({ error: 'Dati del viaggio incompleti' });
        }
        if (!Number.isFinite(kmIniziali)) {
            return res.status(400).json({ error: 'I km iniziali devono essere un numero valido' });
        }

        let kmFinali = kmFinaliInput;
        let kmTotali = kmTotaliInput;

        if (kmTotali !== null) {
            if (!Number.isFinite(kmTotali)) {
                return res.status(400).json({ error: 'I km totali devono essere un numero valido' });
            }
            kmFinali = parseFloat((kmIniziali + kmTotali).toFixed(1));
        }

        if (kmFinali !== null) {
            if (!Number.isFinite(kmFinali)) {
                return res.status(400).json({ error: 'I km finali devono essere un numero valido' });
            }
            if (kmFinali < kmIniziali) {
                return res.status(400).json({ error: 'I km finali devono essere maggiori o uguali ai km iniziali' });
            }
            if (kmTotali === null) {
                kmTotali = parseFloat((kmFinali - kmIniziali).toFixed(1));
            }
        }

        const maxId = dati.reduce((acc, viaggio) => Math.max(acc, viaggio.id || 0), 0);
        const nuovoViaggio = {
            id: maxId + 1,
            data: req.body.data,
            oraPartenza: req.body.oraPartenza,
            oraFine: req.body.oraFine || null,
            kmIniziali: kmIniziali,
            kmFinali: kmFinali,
            kmTotali: kmTotali,
            da: req.body.da,
            a: req.body.a,
            tipoPercorso: req.body.tipoPercorso,
            tipoPercorsoLabel: req.body.tipoPercorsoLabel || '',
            passeggeri: Array.isArray(req.body.passeggeri) ? req.body.passeggeri : [],
            motivoViaggio: req.body.motivoViaggio || ''
        };
        dati.push(nuovoViaggio);
        fs.writeFileSync(DATI_FILE, JSON.stringify(ordinaViaggi(dati), null, 2));
        res.json({ success: true, viaggio: nuovoViaggio });
    } catch (error) {
        console.error('POST /api/viaggi error:', error);
        res.status(500).json({ error: 'Errore nel salvataggio del viaggio' });
    }
});

// PUT - Modifica km finali e ora fine
app.put('/api/viaggi/:id', (req, res) => {
    try {
        const dati = leggiJSON(DATI_FILE);
        const id = parseInt(req.params.id);
        const index = dati.findIndex(v => v.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Viaggio non trovato' });
        }

        const viaggio = dati[index];
        if (req.body.kmFinali !== undefined) {
            const kmFinali = parseFloat(req.body.kmFinali);
            const kmIniziali = parseFloat(viaggio.kmIniziali);
            if (!Number.isFinite(kmFinali)) {
                return res.status(400).json({ error: 'I km finali devono essere un numero valido' });
            }
            if (kmFinali < kmIniziali) {
                return res.status(400).json({ error: 'I km finali devono essere maggiori o uguali ai km iniziali' });
            }
            viaggio.kmFinali = kmFinali;
        }
        if (req.body.oraFine !== undefined) viaggio.oraFine = req.body.oraFine;
        viaggio.kmTotali = Number.isFinite(parseFloat(viaggio.kmFinali)) ? (parseFloat(viaggio.kmFinali) - parseFloat(viaggio.kmIniziali)).toFixed(1) : viaggio.kmIniziali;

        dati[index] = viaggio;
        fs.writeFileSync(DATI_FILE, JSON.stringify(ordinaViaggi(dati), null, 2));
        res.json({ success: true, viaggio });
    } catch (error) {
        console.error('PUT /api/viaggi/:id error:', error);
        res.status(500).json({ error: 'Errore nella modifica del viaggio' });
    }
});

// DELETE - Elimina un viaggio
app.delete('/api/viaggi/:id', (req, res) => {
    try {
        let dati = leggiJSON(DATI_FILE);
        dati = dati.filter(v => v.id !== parseInt(req.params.id));
        fs.writeFileSync(DATI_FILE, JSON.stringify(dati, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Errore nell\'eliminazione del viaggio' });
    }
});

// DELETE - Elimina tutti i viaggi
app.delete('/api/viaggi', (req, res) => {
    try {
        fs.writeFileSync(DATI_FILE, JSON.stringify([], null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Errore nell\'eliminazione dei viaggi' });
    }
});

app.listen(PORT, 'localhost', () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
});