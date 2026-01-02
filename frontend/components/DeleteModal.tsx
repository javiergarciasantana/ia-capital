import React from "react";

interface DeleteModalProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  thingToDelete: string;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  open,
  onClose,
  onDelete,
  thingToDelete,
}) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(26,35,64,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          padding: "32px 28px",
          minWidth: 320,
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "popInModal 0.3s cubic-bezier(.68,-0.55,.27,1.55)",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#e74c3c",
            marginBottom: 12,
          }}
        >
          ¿Estás seguro que quieres eliminar
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#e74c3c",
            marginBottom: 12,
          }}
        >
          <b>{thingToDelete}</b>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 28px",
              border: "1px solid #ddd",
              background: "#fff",
              color: "#555",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "15px",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            No
          </button>
          <button
            onClick={async () => {
              await onDelete();
              onClose();
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            style={{
              padding: "10px 28px",
              border: "none",
              background: "#e74c3c",
              color: "#fff",
              borderRadius: "6px",
              fontWeight: 700,
              fontSize: "15px",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;