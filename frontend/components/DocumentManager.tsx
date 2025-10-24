import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

type FileItem = {
  id: number;
  filename: string;
  originalName: string;
  title?: string;
  description?: string;
  type: string;
  date: string;
  month: string;
  year: string;
  bank: string;
  user: {
    email: string;
  };
};

export default function DocumentManager() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState('');
  const [type, setType] = useState('mensual');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [bank, setBank] = useState('BBVA');

  const API_BASE = 'https://ia-capital-web-iacapital.fn24pb.easypanel.host/api' as const;  const router = useRouter();
  const { auth } = useAuth();

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      const data = await res.json();
      setFiles(data);
    } catch {
      setError('Error al obtener archivos');
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] || null);
    if (!title && e.target.files?.[0]) {
      setTitle(e.target.files[0].name); // autocompletar título si está vacío
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !auth || !month || !year || !bank) {
      setError('Faltan campos obligatorios');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title || selectedFile.name);
    formData.append('description', description);
    formData.append('month', month);
    formData.append('year', year);
    formData.append('bank', bank);
    formData.append('type', type);
    formData.append('date', new Date().toISOString());
    formData.append('userId', String(auth.userId));

    try {
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Fallo al subir archivo');

      await fetchFiles();
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setMonth('');
      setYear('');
      setError('');
      router.push('/admin-panel');
    } catch {
      setError('No se pudo subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="document-manager">
      {/* 🔙 Botón de regreso */}
      <button className="back-button" onClick={() => router.push('/admin-panel')}>
        ← Volver
      </button>

      <h2>Gestión de Documentos PDF</h2>

      <div className="upload-section">
        <input type="file" accept="application/pdf" onChange={handleFileChange} />
        <input
          type="text"
          placeholder="Título (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <select value={month} onChange={(e) => setMonth(e.target.value)} required>
          <option value="">Seleccionar mes</option>
          {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
            .map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          type="number"
          placeholder="Año"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          required
        />
        <select value={bank} onChange={(e) => setBank(e.target.value)}>
          <option value="BBVA">BBVA</option>
          <option value="Santander">Santander</option>
          <option value="JPMorgan">JPMorgan</option>
          <option value="Varios">Varios</option>
        </select>
        <button onClick={handleUpload} disabled={!selectedFile || uploading}>
          {uploading ? 'Subiendo...' : 'Subir'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <ul className="file-list">
        {files.map((file) => (
          <li key={file.id}>
            <strong>{file.title || file.originalName}</strong> ({file.type}, {file.month} {file.year}, {file.bank})<br />
            {file.description && <em>{file.description}</em>}<br />
            Usuario: {file.user.email}<br />
            <a href={`${API_BASE}/uploads/${file.filename}`} target="_blank" rel="noreferrer">
              Ver / Descargar
            </a>{' '}
            | <button className="edit-btn">✏️ Editar</button>{' '}
            <button className="delete-btn">🗑 Eliminar</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
