import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { listDocumentMessages, type DocumentMessage } from "../../services/documents";

export function useWorkflowMessaging(versionId: number, myUserId: number | null) {
  const [messages, setMessages] = useState<DocumentMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const prevMessageCountRef = useRef<number>(0);
  const isFirstMessageLoadRef = useRef(true);

  // Initial load and versionId cleanup
  useEffect(() => {
    if (!versionId || versionId === 0) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    let alive = true;
    setIsLoadingMessages(true);
    // Clear and start fresh for new version
    setMessages([]);

    listDocumentMessages(versionId)
      .then((m) => {
        if (!alive) return;
        setMessages(m);
        const incoming = m.filter(msg => Number(msg.sender_user_id) !== Number(myUserId));
        prevMessageCountRef.current = incoming.length;
        isFirstMessageLoadRef.current = false;
      })
      .catch((err) => {
        console.error("[useWorkflowMessaging] Initial load failed:", err);
        if (alive) setMessages([]);
      })
      .finally(() => {
        if (alive) setIsLoadingMessages(false);
      });

    return () => { alive = false; };
  }, [versionId, myUserId]);

  const pollMessages = useCallback(async (id: number) => {
    if (!id || id === 0) return;
    try {
      const m = await listDocumentMessages(id);
      setMessages(m);
      
      const incoming = m.filter(msg => Number(msg.sender_user_id) !== Number(myUserId));
      if (!isFirstMessageLoadRef.current) {
        const newCount = incoming.length - prevMessageCountRef.current;
        if (newCount > 0) setNewMessageCount(prev => prev + newCount);
      } else {
        isFirstMessageLoadRef.current = false;
      }
      prevMessageCountRef.current = incoming.length;
    } catch (err) {
      console.warn("[useWorkflowMessaging] Polling failed:", err);
    }
  }, [myUserId]);

  const pushMessage = useCallback((incoming: DocumentMessage) => {
    setMessages(prev => {
      if (prev.some(m => m.id === incoming.id)) return prev;
      return [...prev, incoming];
    });
    if (Number(incoming.sender_user_id) !== Number(myUserId)) {
      setNewMessageCount(c => c + 1);
    }
  }, [myUserId]);

  const clearNewMessageCount = useCallback(() => setNewMessageCount(0), []);

  return useMemo(() => ({
    messages,
    setMessages,
    isLoadingMessages,
    newMessageCount,
    clearNewMessageCount,
    pollMessages,
    pushMessage,
  }), [
    messages,
    isLoadingMessages,
    newMessageCount,
    clearNewMessageCount,
    pollMessages,
    pushMessage,
  ]);
}
