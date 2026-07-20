"use client";

import { useState } from "react";
import { Button, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "competition-covers";

export default function ImageUpload({ currentUrl, onUpload }: { currentUrl?: string | null; onUpload: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onUpload(publicUrl);
      message.success("Image uploaded");
    } catch (err) {
      message.error("Upload failed");
    } finally {
      setUploading(false);
    }
    return false; // prevent default antd upload
  };

  return (
    <div>
      {currentUrl && (
        <img src={currentUrl} alt="Cover" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
      )}
      <Upload beforeUpload={handleUpload} showUploadList={false} accept="image/png,image/jpeg,image/webp">
        <Button icon={<UploadOutlined />} loading={uploading}>
          {currentUrl ? "Change Image" : "Upload Cover Image"}
        </Button>
      </Upload>
    </div>
  );
}
