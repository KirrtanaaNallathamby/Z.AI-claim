import { useState, useRef } from 'react';
import supabase from '../api/supabase';

export default function FileUpload({ label, accept, bucketPath, onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFileName(file.name);

    const ext = file.name.split('.').pop();
    const path = `${bucketPath}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('claim-evidence')
      .upload(path, file);

    if (error) {
      alert('Upload failed: ' + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('claim-evidence')
      .getPublicUrl(path);

    onUploadComplete(urlData.publicUrl);
    setUploading(false);
  };

  return (
    <div className="file-upload">
      <label className="file-upload-label">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFile}
        disabled={uploading}
      />
      {uploading && <span className="uploading-text">Uploading...</span>}
      {fileName && !uploading && <span className="uploaded-text">{fileName} uploaded</span>}
    </div>
  );
}
