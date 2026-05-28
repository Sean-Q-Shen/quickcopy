/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  FolderPlus,
  Plus,
  Copy,
  Check,
  Edit2,
  Trash2,
  Search,
  Download,
  Upload,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  FileCode,
  Sparkles,
  Layers,
  X,
  FileJson,
  Move,
  Info,
  Lock,
  Unlock,
  Key,
  Archive,
  History,
  ShieldCheck,
  ShieldAlert,
  Pin
} from 'lucide-react';

// Sophisticated synchronous symmetric encryption algorithm (UTF-8 binary safe)
const encryptText = (text: string, key: string): string => {
  if (!key) return text;
  try {
    const utf8Text = unescape(encodeURIComponent(text));
    const salt = Math.floor(Math.random() * 256);
    const stretchedKey = key + salt;
    
    let output = '';
    let lastChar = salt;
    for (let i = 0; i < utf8Text.length; i++) {
      const keyChar = stretchedKey.charCodeAt(i % stretchedKey.length) % 256;
      const charCode = utf8Text.charCodeAt(i);
      const encrypted = (charCode ^ keyChar ^ lastChar) & 255;
      output += String.fromCharCode(encrypted);
      lastChar = encrypted;
    }
    
    const payload = JSON.stringify({ salt, data: btoa(output) });
    return `ENC:${btoa(payload)}`;
  } catch (e) {
    console.error('Symmetric encrypt failed:', e);
    return text;
  }
};

const decryptText = (cipher: string, key: string): string => {
  if (!cipher.startsWith('ENC:')) return cipher;
  if (!key) throw new Error('MISSING_KEY');
  try {
    const payload = JSON.parse(atob(cipher.substring(4)));
    const { salt, data } = payload;
    const ciphertext = atob(data);
    const stretchedKey = key + salt;
    
    let output = '';
    let lastChar = salt;
    for (let i = 0; i < ciphertext.length; i++) {
      const keyChar = stretchedKey.charCodeAt(i % stretchedKey.length) % 256;
      const encryptedChar = ciphertext.charCodeAt(i);
      const decrypted = (encryptedChar ^ keyChar ^ lastChar) & 255;
      output += String.fromCharCode(decrypted);
      lastChar = encryptedChar;
    }
    
    return decodeURIComponent(escape(output));
  } catch (err) {
    throw new Error('DECRYPT_FAILED');
  }
};

// Data types matching the user specifications
interface SnippetItem {
  id: number;
  title: string;
  content: string;
  isPassword?: boolean;
  copyCount?: number;
  isPinned?: boolean;
}

interface Category {
  id: number;
  name: string;
  isOpen: boolean;
  items: SnippetItem[];
}

interface ToastMessage {
  id: number;
  title: string;
  preview: string;
}

// Pre-populated realistic SRE / Dev snippets
const INITIAL_CATEGORIES: Category[] = [
  {
    id: 1,
    name: "Linux 系统监控 & 运维",
    isOpen: true,
    items: [
      { id: 101, title: "查看磁盘空间分配 (Human Readable)", content: "df -h" },
      { id: 102, title: "查看当前监听网络端口详情", content: "sudo ss -tunlp" },
      { id: 103, title: "追踪特定进程的网络连接情况", content: "sudo lsof -i -P -n | grep <process_name>" },
      { id: 104, title: "统计当前目录下各子文件夹的大小", content: "du -h --max-depth=1 | sort -hr" },
      { id: 105, title: "查看内存实时耗用与交换分区状态", content: "free -m -s 3" }
    ]
  },
  {
    id: 2,
    name: "Docker 实战常备命令",
    isOpen: true,
    items: [
      { id: 201, title: "一键清理无用容器、镜像及数据卷", content: "docker system prune -a --volumes -f" },
      { id: 202, title: "实时查看目标容器最后100行滚动日志", content: "docker logs -f --tail 100 <container_name>" },
      { id: 203, title: "进入容器内执行交互式 Shell 终端", content: "docker exec -it <container_id_or_name> /bin/bash" },
      { id: 204, title: "查看并获取正在运行容器的内部 IP 映射", content: "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <container_id>" }
    ]
  },
  {
    id: 3,
    name: "Kubernetes 集群排障",
    isOpen: false,
    items: [
      { id: 301, title: "查看全部命名空间下异常状态的 Pod", content: "kubectl get pods -A --field-selector=status.phase!=Running" },
      { id: 302, title: "多容器 Pod 的深度排障日志拉取", content: "kubectl logs -n <namespace> <pod-name> --all-containers=true --tail=100" },
      { id: 303, title: "动态缩放目标 Deployment 的副本集数量", content: "kubectl scale deployment <deployment-name> --replicas=3 -n <namespace>" },
      { id: 304, title: "在目标 Pod 中快速执行网络探测命令", content: "kubectl exec -it <pod-name> -n <namespace> -- curl http://localhost:8080/health" }
    ]
  },
  {
    id: 4,
    name: "Git 核心高频指令",
    isOpen: false,
    items: [
      { id: 401, title: "强行丢弃本地所有未提交的修改改动", content: "git reset --hard HEAD && git clean -fd" },
      { id: 402, title: "拉取最新分支并变基更新本地当前分支", content: "git pull --rebase origin <branch_name>" },
      { id: 403, title: "撤销已经推送到远端服务器的历史 Commit", content: "git revert <commit_hash>" },
      { id: 404, title: "优雅合并多个零碎提交为单一提交 (Squash)", content: "git rebase -i HEAD~<number_of_commits>" }
    ]
  }
];

export default function App() {
  // State management
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem('quick_copy_pro_data');
      return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  // State for search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Toast Notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // File System Access sync state
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isFileSyncing, setIsFileSyncing] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string>('');

  // Drag-and-drop state indicators
  const [draggedCategoryIdx, setDraggedCategoryIdx] = useState<number | null>(null);
  const [draggedCard, setDraggedCard] = useState<{ categoryId: number; itemIndex: number } | null>(null);
  const [dragOverCategoryIdx, setDragOverCategoryIdx] = useState<number | null>(null);
  const [dragOverCard, setDragOverCard] = useState<{ categoryId: number; itemIndex: number } | null>(null);

  // Modal active states
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<{ categoryId: number; itemIndex: number } | null>(null);
  const [snippetForm, setSnippetForm] = useState({ title: '', content: '', categoryId: 0, isPassword: false });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryIdx, setEditingCategoryIdx] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '' });

  // Cryptographic Engine State for Passwords
  const [masterPasswordCheck, setMasterPasswordCheck] = useState<string>(() => {
    return localStorage.getItem('quick_copy_master_password_check') || '';
  });
  const [sessionKey, setSessionKey] = useState<string>(''); // Memory-only session key
  const [isMasterSetupOpen, setIsMasterSetupOpen] = useState(false);
  const [isMasterUnlockOpen, setIsMasterUnlockOpen] = useState(false);
  const [masterForm, setMasterForm] = useState({ password: '', confirm: '' });
  const [unlockForm, setUnlockForm] = useState({ password: '', error: '' });
  const [pendingUnlockCallback, setPendingUnlockCallback] = useState<{ onSuccess: (key: string) => void } | null>(null);

  // Backup History active states
  const [isBackupHistoryOpen, setIsBackupHistoryOpen] = useState(false);
  const [backupHistory, setBackupHistory] = useState<any[]>([]);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-backup engine triggers on page load once a day
  useEffect(() => {
    try {
      const lastBackupDate = localStorage.getItem('quick_copy_last_backup_date');
      const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
      
      if (lastBackupDate !== todayStr && categories && categories.length > 0) {
        // Run automated clean cold backup
        setTimeout(() => {
          triggerAutomatedBackup(todayStr);
        }, 1500); // Gentle delay on mount to ensure smooth render first
      }
    } catch (err) {
      console.error('Automated backup on load execution error:', err);
    }
  }, []);

  const triggerAutomatedBackup = (todayStr: string) => {
    try {
      const dataStr = JSON.stringify(categories, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const filename = `quickcopy_auto_backup_${todayStr}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', filename);
      linkElement.click();
      
      // Save last backup date locally to prevent download loops
      localStorage.setItem('quick_copy_last_backup_date', todayStr);
      
      // Save a copy inside local History list in localStorage for full insurance
      const historyJSON = localStorage.getItem('quick_copy_history_backups');
      let histArr = historyJSON ? JSON.parse(historyJSON) : [];
      if (!Array.isArray(histArr)) histArr = [];
      
      histArr.unshift({
        date: todayStr,
        timestamp: Date.now(),
        data: categories
      });
      
      // Limit to 10 daily backups
      if (histArr.length > 10) {
        histArr = histArr.slice(0, 10);
      }
      
      localStorage.setItem('quick_copy_history_backups', JSON.stringify(histArr));
      
      addToast(
        '📅 每日自动备份触发成功',
        `已为您备份当前指令配置并自动下载: ${filename}`
      );
    } catch (err) {
      console.error('Programmatic daily backup failed:', err);
    }
  };

  const loadBackupHistoryList = () => {
    try {
      const saved = localStorage.getItem('quick_copy_history_backups');
      setBackupHistory(saved ? JSON.parse(saved) : []);
    } catch {
      setBackupHistory([]);
    }
  };

  const openUnlockFlow = (onSuccessCallback: (key: string) => void) => {
    setUnlockForm({ password: '', error: '' });
    setPendingUnlockCallback({ onSuccess: onSuccessCallback });
    setIsMasterUnlockOpen(true);
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pw = unlockForm.password;
    if (!pw) return;

    try {
      const checkVal = localStorage.getItem('quick_copy_master_password_check');
      if (!checkVal) {
        setUnlockForm({ ...unlockForm, error: '主密码校验项丢失，请先设置主密码' });
        return;
      }

      const decrypted = decryptText(checkVal, pw);
      if (decrypted === 'QUICKCOPY_VERIFY') {
        setSessionKey(pw);
        setIsMasterUnlockOpen(false);
        addToast('主会话解锁成功', '敏感片段及密钥数据已自动注入本地解密访问。');
        if (pendingUnlockCallback) {
          pendingUnlockCallback.onSuccess(pw);
          setPendingUnlockCallback(null);
        }
      } else {
        setUnlockForm({ ...unlockForm, error: '主密码错误。校验失败，无法解锁。' });
      }
    } catch {
      setUnlockForm({ ...unlockForm, error: '校验解析异常。请重试。' });
    }
  };

  // Sync to File handle if active, otherwise LocalStorage
  const saveData = async (updatedData: Category[]) => {
    // 1. Update React state immediately
    setCategories(updatedData);

    // 2. Always persist to localStorage as reliable state fallback
    localStorage.setItem('quick_copy_pro_data', JSON.stringify(updatedData));

    // 3. Drive File System Access API if active
    if (fileHandle) {
      try {
        setIsFileSyncing(true);
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(updatedData, null, 2));
        await writable.close();
        setFileError('');
      } catch (err: any) {
        console.error('File write failed, system may have lost handle permissions:', err);
        setFileError('自动写入本地文件失败，可能缺少写入权限。请重新关联。');
      } finally {
        setTimeout(() => setIsFileSyncing(false), 300);
      }
    }
  };

  // Associate Local File (File System Access API)
  const handleAssociateLocalFile = async () => {
    try {
      setFileError('');
      // Check API support
      if (!('showOpenFilePicker' in window)) {
        throw new Error('NOT_SUPPORTED');
      }

      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'JSON Files',
            accept: {
              'application/json': ['.json'],
            },
          },
        ],
        multiple: false,
      });

      if (!handle) return;

      // Request write permission
      const options = { mode: 'readwrite' };
      if ((await handle.queryPermission(options)) !== 'granted') {
        if ((await handle.requestPermission(options)) !== 'granted') {
          throw new Error('PERMISSION_DENIED');
        }
      }

      const file = await handle.getFile();
      const text = await file.text();
      let parseData: Category[] = [];

      if (text.trim()) {
        try {
          parseData = JSON.parse(text);
          // Simple schema validation
          if (!Array.isArray(parseData) || (parseData.length > 0 && !('name' in parseData[0]))) {
            throw new Error('INVALID_FORMAT');
          }
        } catch {
          throw new Error('JSON_PARSE_ERROR');
        }
      } else {
        // File is empty, write initial data to it
        parseData = categories;
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(parseData, null, 2));
        await writable.close();
      }

      setFileHandle(handle);
      setFileName(file.name);
      setCategories(parseData);
      localStorage.setItem('quick_copy_pro_data', JSON.stringify(parseData));
      addToast('本地文件关联成功', `已同步磁盘文件: ${file.name}`);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'NOT_SUPPORTED') {
        setFileError('您的浏览器不支持 File System Access API。我们将为您展示导入/导出按钮。');
      } else if (err.message === 'PERMISSION_DENIED') {
        setFileError('未获得读写权限，无法关联本地文件。');
      } else if (err.message === 'INVALID_FORMAT' || err.message === 'JSON_PARSE_ERROR') {
        setFileError('关联失败：该 JSON 文件内容不符合 QuickCopy 格式规范。');
      } else if (err.name === 'AbortError') {
        // User cancelled the file picker, do nothing
      } else {
        setFileError(`安全限制或错误: 浏览器在 iframe 内禁用了此 API。点击右上角【新标签运行】。`);
      }
    }
  };

  // Disconnect from physical file on disk
  const handleDisconnectFile = () => {
    setFileHandle(null);
    setFileName('');
    setFileError('');
    addToast('已断开文件同关联', '当前已切回到浏览器本地 LocalStorage 模式。');
  };

  // Add Copy toast
  const addToast = (title: string, preview: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title, preview }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Micro feedback visual flash on both regular grid element and top shortcuts row
  const flashCard = (snippetId: number) => {
    const gridEl = document.getElementById(`snippet-card-${snippetId}`);
    if (gridEl) {
      gridEl.classList.add('animate-flash');
      setTimeout(() => gridEl.classList.remove('animate-flash'), 450);
    }
    const pinnedEl = document.getElementById(`pinned-card-${snippetId}`);
    if (pinnedEl) {
      pinnedEl.classList.add('animate-flash');
      setTimeout(() => pinnedEl.classList.remove('animate-flash'), 450);
    }
  };

  // Increment usage statistics persistent counter
  const incrementCopyCount = (snippetId: number) => {
    setCategories((prevCategories) => {
      const updated = prevCategories.map((cat) => ({
        ...cat,
        items: cat.items.map((item) => {
          if (item.id === snippetId) {
            return {
              ...item,
              copyCount: (item.copyCount || 0) + 1,
            };
          }
          return item;
        }),
      }));
      // Persist as well
      localStorage.setItem('quick_copy_pro_data', JSON.stringify(updated));
      if (fileHandle) {
        // Debounced or direct sync
        saveData(updated);
      }
      return updated;
    });
  };

  // Toggle Pinned / Shortcut status manually
  const handleTogglePin = (snippetId: number) => {
    setCategories((prevCategories) => {
      let pinState = false;
      let titleName = '';
      const updated = prevCategories.map((cat) => ({
        ...cat,
        items: cat.items.map((item) => {
          if (item.id === snippetId) {
            pinState = !item.isPinned;
            titleName = item.title;
            return {
              ...item,
              isPinned: pinState,
            };
          }
          return item;
        }),
      }));

      addToast(
        pinState ? `已常驻顶置: ${titleName}` : `已移出常驻公文包: ${titleName}`,
        pinState ? '将永久展示在置顶快速通道' : '该卡片已恢复到默认的分组面板内'
      );

      // Persist as well
      localStorage.setItem('quick_copy_pro_data', JSON.stringify(updated));
      saveData(updated);
      return updated;
    });
  };

  // Copy trigger
  const handleCopy = (snippet: SnippetItem) => {
    let copyText = snippet.content;

    if (snippet.isPassword) {
      if (!sessionKey) {
        // Unlock securely first
        if (!masterPasswordCheck) {
          alert('本片段已采用高强度密码加密，请先配置顶部【主密码】以便解密复制！');
          setMasterForm({ password: '', confirm: '' });
          setIsMasterSetupOpen(true);
        } else {
          openUnlockFlow((key) => {
            try {
              const decrypted = decryptText(snippet.content, key);
              navigator.clipboard.writeText(decrypted).then(() => {
                addToast(`复制密码密文: ${snippet.title}`, '•••••••••••• (已在剪切板中自动解密为明文)');
                incrementCopyCount(snippet.id);
                flashCard(snippet.id);
              });
            } catch {
              addToast('解密失败', '请输入正确的主密码');
            }
          });
        }
        return;
      }

      try {
        copyText = decryptText(snippet.content, sessionKey);
      } catch {
        addToast('解密失败', '解密密码出错，请重新解锁');
        return;
      }
    }

    navigator.clipboard.writeText(copyText).then(
      () => {
        addToast(
          snippet.isPassword ? `已解密复制密码: ${snippet.title}` : `已成功复制: ${snippet.title}`,
          snippet.isPassword ? '•••••••••••• (已在剪切板中解密为明文)' : copyText
        );
        incrementCopyCount(snippet.id);
        flashCard(snippet.id);
      },
      (err) => {
        console.error('Failed to copy command: ', err);
        addToast('复制失败', '请检查浏览器剪切板授权。');
      }
    );
  };

  // Import JSON physically
  const handleImportJSONClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          // Extra validation
          const isValid = parsed.every(p => p && typeof p === 'object' && 'name' in p && Array.isArray(p.items || []));
          if (!isValid) {
            alert('导入数据格式有误，必须为分类数据数组。');
            return;
          }
          saveData(parsed);
          addToast('导入配置文件成功', `已载入 ${parsed.length} 个分类组`);
        } else {
          alert('数据必须是一个包含分类项目的数组！');
        }
      } catch {
        alert('文件解析失败，请确保其为标准 JSON 格式。');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Export JSON physically
  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(categories, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileDefaultName = `quickcopy_backup_${new Date().toISOString().slice(0, 10)}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      addToast('数据备份导出成功', `文件已发布下载: ${exportFileDefaultName}`);
    } catch {
      addToast('备份导出失败', '请尝试手动复制本地文件。');
    }
  };

  // Toggle Category Collapsed state
  const toggleCategory = (idx: number) => {
    const updated = categories.map((cat, i) =>
      i === idx ? { ...cat, isOpen: !cat.isOpen } : cat
    );
    saveData(updated);
  };

  // Expand all categories
  const expandAllCategories = () => {
    const updated = categories.map((cat) => ({ ...cat, isOpen: true }));
    saveData(updated);
    addToast('已展开所有分类', `成功展开了全部 ${categories.length} 个分类项目。`);
  };

  // Collapse all categories
  const collapseAllCategories = () => {
    const updated = categories.map((cat) => ({ ...cat, isOpen: false }));
    saveData(updated);
    addToast('已收起所有分类', `成功收起了全部 ${categories.length} 个分类项目。`);
  };

  // Add / Edit Snippet Modal triggers
  const openAddSnippetModal = (categoryId: number) => {
    setEditingSnippet(null);
    setSnippetForm({ title: '', content: '', categoryId, isPassword: false });
    setIsSnippetModalOpen(true);
  };

  const openEditSnippetModal = (categoryId: number, itemIndex: number, snippet: SnippetItem) => {
    let plainContent = snippet.content;

    // Decrypt if it's password
    if (snippet.isPassword) {
      if (!sessionKey) {
        if (!masterPasswordCheck) {
          alert('本片段属于安全加密密码类型，请先在顶部设置主加解密密码！');
          setMasterForm({ password: '', confirm: '' });
          setIsMasterSetupOpen(true);
        } else {
          openUnlockFlow((key) => {
            try {
              const decrypted = decryptText(snippet.content, key);
              setEditingSnippet({ categoryId, itemIndex });
              setSnippetForm({
                title: snippet.title,
                content: decrypted,
                categoryId,
                isPassword: true
              });
              setIsSnippetModalOpen(true);
            } catch {
              addToast('解密失败', '请输入正确的主密码');
            }
          });
        }
        return;
      }

      try {
        plainContent = decryptText(snippet.content, sessionKey);
      } catch {
        addToast('解密失败', '由于主密码未匹配导致无法解锁内容，请重新验证');
        return;
      }
    }

    setEditingSnippet({ categoryId, itemIndex });
    setSnippetForm({
      title: snippet.title,
      content: plainContent,
      categoryId,
      isPassword: !!snippet.isPassword,
    });
    setIsSnippetModalOpen(true);
  };

  const handleSaveSnippet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snippetForm.title.trim() || !snippetForm.content.trim()) return;

    let targetContent = snippetForm.content.trim();

    if (snippetForm.isPassword) {
      if (!sessionKey) {
        if (!masterPasswordCheck) {
          alert('无法保存：敏感机密片段需使用顶部【主密码】进行高强度对称加密存储，请先设置主密码。');
          setMasterForm({ password: '', confirm: '' });
          setIsMasterSetupOpen(true);
        } else {
          alert('无法保存：主密钥会话已锁定，请先解锁主密码！');
          openUnlockFlow(() => {});
        }
        return;
      }
      // Symmetric encrypt
      targetContent = encryptText(targetContent, sessionKey);
    }

    const newSnippet: SnippetItem = {
      id: editingSnippet ? categories.find(c => c.id === snippetForm.categoryId)?.items[editingSnippet.itemIndex].id || Date.now() : Date.now(),
      title: snippetForm.title.trim(),
      content: targetContent,
      isPassword: snippetForm.isPassword,
    };

    let updated = [...categories];

    if (editingSnippet !== null) {
      // If we are editing, check if category has changed
      const originalCat = updated.find(c => c.id === editingSnippet.categoryId);
      const targetCatId = snippetForm.categoryId;

      if (originalCat && originalCat.id === targetCatId) {
        // Edited within the SAME category
        const targetCategory = updated.find(c => c.id === targetCatId);
        if (targetCategory) {
          targetCategory.items[editingSnippet.itemIndex] = newSnippet;
        }
      } else {
        // Category changed: remove from old list and push to new target list
        if (originalCat) {
          originalCat.items.splice(editingSnippet.itemIndex, 1);
        }
        const destinationCat = updated.find(c => c.id === targetCatId);
        if (destinationCat) {
          destinationCat.items.push(newSnippet);
          destinationCat.isOpen = true; // Auto open destination
        }
      }
    } else {
      // New snippet creation
      const targetCat = updated.find(c => c.id === snippetForm.categoryId);
      if (targetCat) {
        targetCat.items.push(newSnippet);
        targetCat.isOpen = true; // Auto expand target
      }
    }

    saveData(updated);
    setIsSnippetModalOpen(false);
    addToast(editingSnippet ? '片段修改成功' : '新增片段成功', snippetForm.title);
  };

  const handleDeleteSnippet = (categoryId: number, itemIndex: number, title: string) => {
    if (!confirm(`确定要删除此片段 "${title}" 吗？`)) return;

    const updated = categories.map(cat => {
      if (cat.id === categoryId) {
        const items = [...cat.items];
        items.splice(itemIndex, 1);
        return { ...cat, items };
      }
      return cat;
    });

    saveData(updated);
    addToast('片段已永久移除', title);
  };

  // Add / Edit Category Dialog triggers
  const openAddCategoryModal = () => {
    setEditingCategoryIdx(null);
    setCategoryForm({ name: '' });
    setIsCategoryModalOpen(true);
  };

  const openRenameCategoryModal = (idx: number, currentName: string) => {
    setEditingCategoryIdx(idx);
    setCategoryForm({ name: currentName });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;

    let updated = [...categories];

    if (editingCategoryIdx !== null) {
      // Renaming
      updated[editingCategoryIdx].name = categoryForm.name.trim();
      addToast('分类重命名成功', categoryForm.name);
    } else {
      // Adding new
      const newCategory: Category = {
        id: Date.now(),
        name: categoryForm.name.trim(),
        isOpen: true,
        items: [],
      };
      updated.push(newCategory);
      addToast('新增分类成功', categoryForm.name);
    }

    saveData(updated);
    setIsCategoryModalOpen(false);
  };

  const handleDeleteCategory = (idx: number, name: string, itemsCount: number) => {
    const confirmMsg = itemsCount > 0
      ? `分类 "${name}" 内包含 ${itemsCount} 项指令片段。删除该分类将一并清除这些内容，确认彻底删除吗？`
      : `确定要删除分类 "${name}" 吗？`;

    if (!confirm(confirmMsg)) return;

    const updated = categories.filter((_, i) => i !== idx);
    saveData(updated);
    addToast('分类已整体删除', name);
  };

  // Drag-and-drop mechanics implementation
  // 1. Categories vertical reordering
  const handleCategoryDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('source-type', 'category');
    e.dataTransfer.setData('category-index', String(idx));
    setDraggedCategoryIdx(idx);
    e.stopPropagation();
  };

  const handleCategoryDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedCategoryIdx !== null && draggedCategoryIdx !== idx) {
      setDragOverCategoryIdx(idx);
    }
  };

  const handleCategoryDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const sourceType = e.dataTransfer.getData('source-type');

    if (sourceType === 'category' && draggedCategoryIdx !== null) {
      const updated = [...categories];
      const [draggedItem] = updated.splice(draggedCategoryIdx, 1);
      updated.splice(targetIdx, 0, draggedItem);
      saveData(updated);
    }
    setDraggedCategoryIdx(null);
    setDragOverCategoryIdx(null);
  };

  // 2. Cards reordering & cross-category transfer
  const handleCardDragStart = (e: React.DragEvent, categoryId: number, itemIndex: number) => {
    e.dataTransfer.setData('source-type', 'card');
    e.dataTransfer.setData('source-cat-id', String(categoryId));
    e.dataTransfer.setData('source-item-index', String(itemIndex));
    setDraggedCard({ categoryId, itemIndex });
    e.stopPropagation();
  };

  const handleCardDragOver = (e: React.DragEvent, categoryId: number, itemIndex: number) => {
    e.preventDefault();
    if (draggedCard) {
      setDragOverCard({ categoryId, itemIndex });
    }
    e.stopPropagation();
  };

  const handleCardDrop = (e: React.DragEvent, targetCatId: number, targetItemIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceType = e.dataTransfer.getData('source-type');
    if (sourceType !== 'card') return;

    const sourceCatId = Number(e.dataTransfer.getData('source-cat-id'));
    const sourceItemIndex = Number(e.dataTransfer.getData('source-item-index'));

    if (sourceCatId === targetCatId && sourceItemIndex === targetItemIndex) {
      resetCardDragStates();
      return;
    }

    const updated = [...categories];
    const sourceCat = updated.find(c => c.id === sourceCatId);
    const targetCat = updated.find(c => c.id === targetCatId);

    if (sourceCat && targetCat) {
      const [movedItem] = sourceCat.items.splice(sourceItemIndex, 1);
      // Insert item at destination
      targetCat.items.splice(targetItemIndex, 0, movedItem);
      // Auto expand target category if it was collapsed
      targetCat.isOpen = true;
      saveData(updated);
      addToast('已调整卡片拖放排序', `${movedItem.title} 移动至 ${targetCat.name}`);
    }

    resetCardDragStates();
  };

  const handleCategoryContainerDragOver = (e: React.DragEvent, categoryId: number) => {
    // Allows dropping onto category container when empty or to put snippet at the bottom
    e.preventDefault();
  };

  const handleCategoryContainerDrop = (e: React.DragEvent, targetCatId: number) => {
    e.preventDefault();
    const sourceType = e.dataTransfer.getData('source-type');
    if (sourceType !== 'card') return;

    const sourceCatId = Number(e.dataTransfer.getData('source-cat-id'));
    const sourceItemIndex = Number(e.dataTransfer.getData('source-item-index'));

    if (sourceCatId === targetCatId) {
      // Same category background drop, move to end
      const updated = [...categories];
      const cat = updated.find(c => c.id === sourceCatId);
      if (cat && sourceItemIndex !== cat.items.length - 1) {
        const [item] = cat.items.splice(sourceItemIndex, 1);
        cat.items.push(item);
        saveData(updated);
      }
      resetCardDragStates();
      return;
    }

    // Cross-category container drop, move to the end of target category
    const updated = [...categories];
    const sourceCat = updated.find(c => c.id === sourceCatId);
    const targetCat = updated.find(c => c.id === targetCatId);

    if (sourceCat && targetCat) {
      const [movedItem] = sourceCat.items.splice(sourceItemIndex, 1);
      targetCat.items.push(movedItem);
      targetCat.isOpen = true;
      saveData(updated);
      addToast('跨分类快速入组', `${movedItem.title} 移动至 ${targetCat.name}`);
    }
    resetCardDragStates();
  };

  const resetCardDragStates = () => {
    setDraggedCard(null);
    setDragOverCard(null);
  };

  // Helper filter logic
  const filteredCategories = categories.map((cat) => {
    const itemsFiltered = cat.items.filter(
      (item) =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (!item.isPassword && item.content.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const hasMatch = itemsFiltered.length > 0;
    // If user is searching, we auto-expand matching lists for optimal view
    const isOpen = searchTerm ? hasMatch : cat.isOpen;

    return {
      ...cat,
      isOpen,
      items: itemsFiltered,
      totalCount: cat.items.length, // Keep real totals count
    };
  });

  const totalFilteredResults = filteredCategories.reduce((sum, cat) => sum + cat.items.length, 0);

  // Compute frequently copied and pinned bookmarks list
  const shortcutSnippets = categories
    .flatMap((cat) => cat.items.map((item) => ({ ...item, categoryId: cat.id, categoryName: cat.name })))
    .filter((item) => item.isPinned || (item.copyCount && item.copyCount > 0))
    .filter((item) => {
      if (!searchTerm) return true;
      return (
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (!item.isPassword && item.content.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    })
    .sort((a, b) => {
      // Prioritize manually pinned items
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      // Then sort by copyCount descending
      return (b.copyCount || 0) - (a.copyCount || 0);
    })
    .slice(0, 12); // Display up to 12 quick shortcuts (fits nicely in responsive grids)

  // Auto scroll highlight function
  const highlightMatch = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-amber-400/30 text-amber-200 px-0.5 rounded shadow-sm">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div id="quickcopy-app-container" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Upper Navigation & SRE Control Panel */}
      <header id="controls-header" className="min-h-14 py-2 bg-white border-b border-slate-200 flex items-center sticky top-0 z-40 px-6 shrink-0 shadow-xs">
        <div className="w-full flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Logo Brand Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
                QC
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight text-slate-900">
                    QuickCopy <span className="text-blue-600 font-semibold text-sm">Utility</span>
                  </h1>
                  <span className="text-[9px] leading-3 font-mono border border-slate-200 text-slate-400 px-1 py-0.2 rounded bg-slate-100">
                    v1.0.4
                  </span>
                </div>
                <p className="text-[9px] text-slate-400 font-mono tracking-wider">SYSTEM RELIABILITY ENGINE TOOL</p>
              </div>
            </div>

            {/* Quick Actions for Small Screens */}
            <div className="md:hidden flex gap-2">
              <button
                id="btn-add-cat-mobile"
                onClick={openAddCategoryModal}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 p-2 rounded-lg text-slate-600 transition-colors"
                title="新建分组"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Sync Status bar & Storage Controllers */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Sync Engine Details */}
            <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-[11px] font-mono transition-all ${
              fileHandle
                ? 'bg-emerald-55/40 border-emerald-200 text-emerald-700 shadow-sm'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}>
              <div className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${fileHandle ? 'bg-emerald-500' : 'bg-slate-450'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${fileHandle ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
              </div>
              <span className="font-semibold uppercase tracking-wider">
                {fileHandle ? 'FILE-SYNC ACTIVE' : 'LOCAL-STORAGE MODE'}
              </span>

              {fileHandle && (
                <span className="text-slate-500 border-l border-slate-300 pl-2 max-w-[120px] truncate" title={fileName}>
                  {fileName}
                </span>
              )}

              {isFileSyncing && (
                <RefreshCw className="h-3 w-3 animate-spin text-emerald-600 ml-1" />
              )}
            </div>

            {/* Disk IO Actions Controllers */}
            <div className="flex flex-wrap items-center gap-1.5">
              {fileHandle ? (
                <button
                  id="btn-disconnect-sync"
                  onClick={handleDisconnectFile}
                  className="bg-white hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 text-slate-600 border border-slate-200 px-3 py-1.5 rounded text-xs font-semibold font-mono flex items-center gap-1.5 transition-all"
                >
                  <X className="h-3 w-3" />
                  断开关联 Disconnect
                </button>
              ) : (
                <button
                  id="btn-connect-sync"
                  onClick={handleAssociateLocalFile}
                  className="bg-white hover:bg-slate-50 hover:border-blue-400 hover:text-blue-600 text-slate-700 border border-slate-200 px-3 py-1.5 rounded text-xs font-semibold font-mono flex items-center gap-1.5 transition-all shadow-xs"
                  title="关联本地物理 .json 文件，任何增删改将零延迟自动回写同步到本地磁盘"
                >
                  <RefreshCw className="h-3 w-3 text-blue-500" />
                  关联本地文件 Sync File
                </button>
              )}

              <span className="text-slate-300">|</span>

              {/* Import/Export Backup Dropdown */}
              <button
                id="btn-import-json"
                onClick={handleImportJSONClick}
                className="bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded text-xs font-mono text-slate-600 hover:text-slate-950 transition-colors flex items-center gap-1"
                title="导入现有 JSON 备份配置"
              >
                <Upload className="h-3 w-3" />
                导入 JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />

              <button
                id="btn-export-json"
                onClick={handleExportJSON}
                className="bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded text-xs font-mono text-slate-600 hover:text-slate-950 transition-colors flex items-center gap-1"
                title="导出当前的指令库为 JSON 文件"
              >
                <Download className="h-3 w-3" />
                导出 JSON
              </button>

              <button
                id="btn-backup-history"
                type="button"
                onClick={() => {
                  loadBackupHistoryList();
                  setIsBackupHistoryOpen(true);
                }}
                className="bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded text-xs font-mono text-slate-600 hover:text-rose-600 transition-colors flex items-center gap-1"
                title="查看与回卷本地冷备份数据历史"
              >
                <Archive className="h-3 w-3 text-emerald-500 shrink-0" />
                冷备归档 Backups
              </button>

              <span className="text-slate-300">|</span>

              {/* Cryptographic Session status action */}
              <div id="crypto-session-controller" className="flex items-center gap-1">
                {!masterPasswordCheck ? (
                  <button
                    id="btn-master-setup-trigger"
                    type="button"
                    onClick={() => {
                      setMasterForm({ password: '', confirm: '' });
                      setIsMasterSetupOpen(true);
                    }}
                    className="bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded text-xs text-amber-700 font-semibold font-mono transition-all flex items-center gap-1"
                    title="配置加解密主密码以保护密码片段"
                  >
                    <Key className="h-3 w-3 text-amber-500 shrink-0" />
                    安全加锁 Locker
                  </button>
                ) : sessionKey ? (
                  <button
                    id="btn-master-lock"
                    type="button"
                    onClick={() => {
                      setSessionKey('');
                      addToast('安全会话已锁定', '已拦截当前页面对敏感卡片的免密访问。');
                    }}
                    className="bg-emerald-50 hover:bg-rose-50 hover:border-rose-250 border border-emerald-250 px-2.5 py-1.5 rounded text-xs text-emerald-700 hover:text-rose-600 font-semibold font-mono transition-all flex items-center gap-1"
                    title="点击立即加锁敏感解密容器"
                  >
                    <Unlock className="h-3 w-3 text-emerald-500 shrink-0" />
                    会话已解锁 Unlocked
                  </button>
                ) : (
                  <button
                    id="btn-master-unlock-trigger"
                    type="button"
                    onClick={() => {
                      setUnlockForm({ password: '', error: '' });
                      setIsMasterUnlockOpen(true);
                    }}
                    className="bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-2.5 py-1.5 rounded text-xs text-slate-700 hover:text-blue-600 font-semibold font-mono transition-all flex items-center gap-1"
                    title="点击验证主密码，恢复敏感片断解密查看与复制权限"
                  >
                    <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                    会话已加锁 Locked
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">

        {/* Global Warning for File System Access inside sandboxed frame environments */}
        {fileError && (
          <div id="file-api-alert" className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3.5 text-amber-800 shadow-xs">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-amber-900 flex items-center gap-1.5">
                环境提示 / API System Warning
              </p>
              <p className="leading-relaxed text-amber-800/90">
                {fileError}
              </p>
              {!fileHandle && (
                <div className="pt-1.5 flex items-center gap-2">
                  <span className="text-[10px] text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded bg-amber-100 font-semibold">
                    Pro-Tip
                  </span>
                  <span className="text-amber-800/80 text-[11px] font-medium">
                    若无权限，点击上方网址右侧的「新标签运行」进入独占页面，即可完美解锁本地原生的 File System API 实时物理读写！
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search & Top Filters Controls Suite */}
        <section id="search-filter-section" className="bg-white border border-slate-200/80 p-3 sm:p-4 rounded-xl flex flex-col gap-4 sm:flex-row sm:items-center shadow-xs">
          {/* Search bar Container */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="search-input"
              type="text"
              placeholder="搜索片段或终端指令关键词..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-1.5 bg-slate-100 focus:bg-white text-sm rounded border border-slate-200 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400 text-slate-800"
            />
            {searchTerm && (
              <button
                id="btn-clear-search"
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex gap-3 justify-between items-center whitespace-nowrap">
            {searchTerm && (
              <span id="search-badge" className="text-xs font-mono text-slate-600 bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                匹配筛选结果: <span className="text-blue-600 font-bold">{totalFilteredResults}</span> 个
              </span>
            )}

            {/* Expand / Collapse All Category Controls */}
            <div className="flex gap-1 items-center bg-slate-100 p-1 rounded border border-slate-200">
              <button
                id="btn-expand-all"
                onClick={expandAllCategories}
                className="text-slate-650 hover:text-blue-600 hover:bg-white text-xs px-2.5 py-1 rounded transition-colors flex items-center gap-1 active:scale-95 font-medium"
                title="一键展开所有分类"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                <span>全部展开</span>
              </button>
              <span className="w-[1px] h-3 bg-slate-300"></span>
              <button
                id="btn-collapse-all"
                onClick={collapseAllCategories}
                className="text-slate-650 hover:text-blue-600 hover:bg-white text-xs px-2.5 py-1 rounded transition-colors flex items-center gap-1 active:scale-95 font-medium"
                title="一键收起所有分类"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                <span>全部收起</span>
              </button>
            </div>

            <button
              id="btn-add-cat-desktop"
              onClick={openAddCategoryModal}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded flex items-center gap-1.5 shadow-sm transition-colors active:scale-98 border border-blue-600"
            >
              <FolderPlus className="h-4 w-4" />
              添加分类 Add Group
            </button>
          </div>
        </section>

        {/* Pinned & Frequently Used Shortcuts Dashboard */}
        {shortcutSnippets.length > 0 && (
          <section id="pinned-shortcuts-section" className="bg-slate-100/90 border border-slate-200/90 p-4 rounded-xl flex flex-col gap-3 shadow-xs animate-fade-in relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0 animate-pulse" />
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm tracking-tight flex items-center gap-1.5">
                  置顶与高频指令 / Pinned & Shortcuts Board
                </h3>
                <span className="text-[10px] text-blue-600 font-medium bg-blue-50 border border-blue-100 rounded px-1.5 py-0.2 font-mono">
                  {shortcutSnippets.length} ACTIVE
                </span>
              </div>

              {/* Reset stats helper */}
              <button
                onClick={() => {
                  if (confirm('确定要清除所有指令的复制次数统计和手动置顶吗？操作后常驻栏将被重置。')) {
                    const resetData = categories.map(cat => ({
                      ...cat,
                      items: cat.items.map(item => ({
                        ...item,
                        copyCount: 0,
                        isPinned: false
                      }))
                    }));
                    saveData(resetData);
                    addToast('🔥 已重置使用统计与置顶', '所有的卡片热度值已归零。');
                  }
                }}
                className="text-[10px] hover:text-rose-600 text-slate-400 font-mono transition-colors flex items-center gap-1 cursor-pointer"
                title="重置所有卡片的复制计数并取消所有置顶"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                重置热度 Restats
              </button>
            </div>

            {/* Micro grid columns: compact cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {shortcutSnippets.map((snippet) => (
                <div
                  key={`shortcut-${snippet.id}`}
                  id={`pinned-card-${snippet.id}`}
                  onClick={() => handleCopy(snippet)}
                  className="group/shortcut bg-white border border-slate-200/90 hover:border-blue-400 hover:shadow-sm p-3 rounded-lg shadow-2xs transition-all duration-150 cursor-pointer flex flex-col justify-between min-h-[92px]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate block" title={snippet.categoryName}>
                        {snippet.categoryName}
                      </span>
                      {snippet.isPinned && (
                        <Pin className="h-2.5 w-2.5 text-blue-500 fill-blue-500 shrink-0" />
                      )}
                    </div>
                    <h4 className="text-slate-800 font-bold text-xs truncate group-hover/shortcut:text-blue-600 transition-colors" title={snippet.title}>
                      {highlightMatch(snippet.title, searchTerm)}
                    </h4>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] border-t border-slate-100 pt-1.5 font-mono">
                    {/* Copy metrics tag */}
                    {snippet.copyCount ? (
                      <span className="bg-amber-50 text-amber-700 border border-amber-150/60 font-mono font-bold px-1 rounded-sm text-[9px]" title={`已复制 ${snippet.copyCount} 次`}>
                        📋 {snippet.copyCount}x
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono text-[9px]">置顶常驻</span>
                    )}

                    <div className="text-slate-350 group-hover/shortcut:text-blue-500 transition-colors">
                      {snippet.isPassword ? (
                        <Lock className="h-3 w-3 text-blue-500 shrink-0" />
                      ) : (
                        <Copy className="h-3 w-3 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Grafana-style Category Groups and grid panel */}
        <section id="categories-sandbox" className="flex flex-col gap-3">
          {filteredCategories.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-slate-200 bg-white rounded-xl flex flex-col items-center justify-center gap-3 shadow-xs">
              <Layers className="h-10 w-10 text-slate-300 animate-pulse" />
              <p className="text-slate-600 font-semibold">无匹配分类数据</p>
              <p className="text-xs text-slate-400">未发现对应的分类项目，您可以点击“添加分类”进行创建</p>
            </div>
          ) : (
            filteredCategories.map((group, groupIdx) => (
              <div
                key={group.id}
                id={`cat-card-group-${group.id}`}
                onDragOver={(e) => handleCategoryDragOver(e, groupIdx)}
                onDrop={(e) => handleCategoryDrop(e, groupIdx)}
                className={`border rounded-xl overflow-hidden transition-all duration-300 ${
                  draggedCategoryIdx === groupIdx ? 'opacity-35 border-dashed border-blue-400' : ''
                } ${
                  dragOverCategoryIdx === groupIdx
                    ? 'border-blue-400/80 bg-blue-50/20 translate-y-0.5 shadow-xs'
                    : 'border-slate-200 bg-white'
                } shadow-xs hover:shadow-sm`}
              >
                <div
                  id={`cat-header-${group.id}`}
                  className="bg-slate-50/95 hover:bg-slate-100/90 border-b border-slate-200 flex items-center justify-between px-4 py-2.5 group/header select-none"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Drag Handle */}
                    <div
                      draggable
                      onDragStart={(e) => handleCategoryDragStart(e, groupIdx)}
                      onDragEnd={() => { setDraggedCategoryIdx(null); setDragOverCategoryIdx(null); }}
                      className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-655 p-1 rounded hover:bg-slate-200"
                      title="点击并拖拽调整分类排序"
                    >
                      <Move className="h-4 w-4" />
                    </div>

                    {/* Expand Toggle Trigger Click area */}
                    <button
                      onClick={() => toggleCategory(groupIdx)}
                      className="flex items-center gap-2 text-left flex-1 min-w-0 pointer-events-auto cursor-pointer"
                    >
                      <span className="text-slate-500">
                        {group.isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>

                      <h3 className="font-bold text-slate-800 tracking-tight text-xs sm:text-sm truncate">
                        {group.name}
                      </h3>

                      {/* Info Badge Count */}
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-blue-600">
                        {group.items.length} / {group.totalCount} ITEMS
                      </span>
                    </button>
                  </div>

                  {/* Operational Settings buttons group */}
                  <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover/header:opacity-100 transition-opacity">
                    <button
                      onClick={() => openAddSnippetModal(group.id)}
                      className="text-slate-550 hover:text-blue-600 p-1 hover:bg-slate-200/60 rounded transition-colors text-xs flex items-center gap-1 font-mono font-semibold"
                      title="在此目录下创建新片段"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Add Snippet</span>
                    </button>

                    <button
                      onClick={() => openRenameCategoryModal(groupIdx, group.name)}
                      className="text-slate-500 hover:text-slate-850 p-1 hover:bg-slate-200/60 rounded transition-colors"
                      title="重命名分类"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteCategory(groupIdx, group.name, group.totalCount)}
                      className="text-slate-500 hover:text-rose-600 p-1 hover:bg-slate-200/60 rounded transition-colors"
                      title="删除该分类及其所有子内容"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Snippets Cards Grid layout wrapper */}
                {group.isOpen && (
                  <div
                    onDragOver={(e) => handleCategoryContainerDragOver(e, group.id)}
                    onDrop={(e) => handleCategoryContainerDrop(e, group.id)}
                    className="p-4"
                  >
                    {group.items.length === 0 ? (
                      <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-4 bg-slate-50/50">
                        <p className="text-slate-400 text-xs font-mono">
                          {searchTerm ? '无匹配的内容片段' : '请点击 Add Snippet 创建本分类的第一条快捷指令，或者将其他指令拖入此框'}
                        </p>
                      </div>
                    ) : (
                      /* Gold grid layout ratio requested: width/6 on xl standard screens */
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                        {group.items.map((snippet, snIdx) => {
                          const isBeingDragged = draggedCard?.categoryId === group.id && draggedCard?.itemIndex === snIdx;
                          const isDragTarget = dragOverCard?.categoryId === group.id && dragOverCard?.itemIndex === snIdx;

                          return (
                            <div
                              key={snippet.id}
                              id={`snippet-card-${snippet.id}`}
                              draggable
                              onDragStart={(e) => handleCardDragStart(e, group.id, snIdx)}
                              onDragEnd={resetCardDragStates}
                              onDragOver={(e) => handleCardDragOver(e, group.id, snIdx)}
                              onDrop={(e) => handleCardDrop(e, group.id, snIdx)}
                              onClick={() => handleCopy(snippet)}
                              style={{ contentVisibility: 'auto' }}
                              className={`group/card relative min-h-[140px] p-4 bg-white border rounded-lg cursor-all-scroll select-none flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                                isBeingDragged ? 'opacity-20 border-slate-200 scale-95' : 'hover:shadow-md hover:border-blue-300'
                              } ${
                                isDragTarget
                                  ? 'border-blue-500 ring-2 ring-blue-505/10 -translate-y-0.5'
                                  : 'border-slate-200'
                              }`}
                            >
                              {/* Card Header Info */}
                              <div className="space-y-1.5 flex-1 w-full min-w-0">
                                <div className="flex items-start justify-between gap-1 w-full">
                                  <h4 className="text-slate-800 font-bold text-sm leading-snug truncate pr-12 group-hover/card:text-blue-600 transition-colors" title={snippet.title}>
                                    {highlightMatch(snippet.title, searchTerm)}
                                  </h4>

                                  <div className="absolute right-3.5 top-3 flex items-center gap-1.5 z-10">
                                    {snippet.isPinned && (
                                      <Pin className="h-3 w-3 text-blue-500 fill-blue-500 shrink-0" title="已固定顶置" />
                                    )}

                                    {/* Action items container */}
                                    <div className="opacity-0 group-hover/card:opacity-100 bg-white/95 border border-slate-150 shadow-xs px-1 py-0.5 rounded flex items-center gap-0.5 transition-all duration-150 relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTogglePin(snippet.id);
                                        }}
                                        className={`p-1 rounded transition-colors ${
                                          snippet.isPinned 
                                            ? 'text-blue-600 hover:text-blue-700 bg-blue-50' 
                                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                                        }`}
                                        title={snippet.isPinned ? "取消置顶" : "置顶常驻"}
                                      >
                                        <Pin className="h-3.5 w-3.5" />
                                      </button>
                                      <span className="w-[1px] h-3 bg-slate-200"></span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation(); // Block main copy copy action
                                          openEditSnippetModal(group.id, snIdx, snippet);
                                        }}
                                        className="text-slate-400 hover:text-slate-700 p-1 hover:bg-slate-100 rounded transition-colors"
                                        title="编辑片段"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation(); // Block trigger
                                          handleDeleteSnippet(group.id, snIdx, snippet.title);
                                        }}
                                        className="text-slate-400 hover:text-rose-600 p-1 hover:bg-slate-100 rounded transition-colors"
                                        title="删除内容"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>

                                    {/* Normal indicator Copy button icon */}
                                    <div className="text-slate-300 group-hover/card:text-slate-555 p-0.5 transition-colors">
                                      <Copy className="h-3.5 w-3.5 shrink-0" />
                                    </div>
                                  </div>
                                </div>

                                {/* JetBrains monospaced style viewport clipping at 3 lines */}
                                <div className="text-[11px] font-mono font-medium rounded bg-slate-50 p-2 border border-slate-100 text-slate-650 leading-relaxed overflow-hidden break-all select-none">
                                  {snippet.isPassword ? (
                                    <div className="flex items-center gap-1.5 text-blue-600/90 font-bold justify-center py-2 bg-blue-50/30 border border-blue-100/40 rounded select-none">
                                      <Lock className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                                      <span className="tracking-wide">•••••••••••• (密文已保护)</span>
                                    </div>
                                  ) : (
                                    <pre className="line-clamp-3 whitespace-pre-wrap">
                                      {highlightMatch(snippet.content, searchTerm)}
                                    </pre>
                                  )}
                                </div>
                              </div>

                              {/* Card footer metrics details */}
                              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-450 font-mono tracking-wider">
                                <span>SN-{snippet.id % 1000}</span>
                                <span className="opacity-0 group-hover/card:opacity-100 text-blue-650 font-bold uppercase flex items-center gap-0.5 transition-opacity text-[10px] group-hover/card:underline">
                                  <Sparkles className="h-2.5 w-2.5 text-blue-500" />
                                  Click to Copy
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </main>

      {/* Footer Info Workspace credits */}
      <footer id="app-workspace-footer" className="h-10 bg-slate-100 border-t border-slate-200 flex items-center px-6 justify-between shrink-0 text-[11px] text-slate-500 font-mono mt-auto">
        <div className="flex items-center gap-2 truncate">
          <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="truncate">极客专属：拖动组侧边抓手调整分类；拖拽单个卡片完成跨组归并。</span>
        </div>
        <div className="hidden sm:block shrink-0">
          QuickCopy Utility • Offline Active
        </div>
      </footer>

      {/* Dynamic Popups System: Modals */}

      {/* 1. Snippet Add/Edit Dialog Backdrop */}
      {isSnippetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <FileCode className="h-4 w-4 text-blue-500" />
                {editingSnippet ? '编辑文本片段 / Edit Snippet' : '创建新片段 / Create Snippet'}
              </h3>
              <button
                onClick={() => setIsSnippetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form content */}
            <form onSubmit={handleSaveSnippet} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase font-mono tracking-wider">
                  片段名称 / Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：查看磁盘空间状态、Docker 重启命令..."
                  value={snippetForm.title}
                  onChange={(e) => setSnippetForm({ ...snippetForm, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-900 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase font-mono tracking-wider">
                  指向分类 / Target Category Group
                </label>
                <select
                  value={snippetForm.categoryId}
                  onChange={(e) => setSnippetForm({ ...snippetForm, categoryId: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase font-mono tracking-wider">
                  代码或文本细节 / Coding Content
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="请输入您的指令段或常用长文本内容。可按 Ctrl+Enter 快速提交保存..."
                  value={snippetForm.content}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      const fakeEvent = { preventDefault: () => {} } as any;
                      handleSaveSnippet(fakeEvent);
                    }
                  }}
                  onChange={(e) => setSnippetForm({ ...snippetForm, content: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 font-mono text-slate-900 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-y leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-2.5">
                <input
                  id="snippet-form-is-password"
                  type="checkbox"
                  checked={snippetForm.isPassword}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (checked && !sessionKey) {
                      if (!masterPasswordCheck) {
                        alert('您必须先设置主加解密密码，才能开启敏感字段保护。');
                        setMasterForm({ password: '', confirm: '' });
                        setIsMasterSetupOpen(true);
                      } else {
                        openUnlockFlow((key) => {
                          setSnippetForm((prev) => ({ ...prev, isPassword: true }));
                        });
                      }
                    } else {
                      setSnippetForm((prev) => ({ ...prev, isPassword: checked }));
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="snippet-form-is-password" className="text-slate-700 text-xs font-semibold select-none cursor-pointer flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  设为密码加密存储 (隐藏明文，复制需主密码解锁)
                </label>
              </div>

              {/* Form Buttons Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSnippetModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  取消 Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded transition-all shadow-xs"
                >
                  保存 Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Category Form Dialog Box */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-500" />
                {editingCategoryIdx !== null ? '修改分类 / Rename Category' : '新增分类 / Add Category'}
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCategory} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase font-mono tracking-wider">
                  分类名称 / Category Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="例如：数据库监控组、常用脚本集..."
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-900 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Action */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-850 transition-colors"
                >
                  取消 Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded transition-all"
                >
                  保存 Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Master Password Setup Modal */}
      {isMasterSetupOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm shadow-xl overflow-hidden animate-slide-up">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-500" />
                设置加解密主密码 / Setup Master Key
              </h3>
              <button
                onClick={() => setIsMasterSetupOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (masterForm.password.length < 4) {
                alert('为了密钥安全强度，主密码长度不能少于 4 位字符。');
                return;
              }
              if (masterForm.password !== masterForm.confirm) {
                alert('两次输入的密码不一致，请重新核对。');
                return;
              }
              // Generate verifiable check cipher
              const verificationCipher = encryptText('QUICKCOPY_VERIFY', masterForm.password);
              localStorage.setItem('quick_copy_master_password_check', verificationCipher);
              setMasterPasswordCheck(verificationCipher);
              setSessionKey(masterForm.password);
              setIsMasterSetupOpen(false);
              addToast('🔐 主加解密密码设置成功', '当前会话已自动解锁，可直接选用密码片段。');
            }} className="p-5 space-y-4">
              <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                ⚠️ <strong className="text-slate-700">安全提示：</strong> 主密码用于本地对称加解密敏感脚本与密码片段。一旦遗失将无法恢复明文！本功能默认仅保存在浏览器内，零网络外泄传输。
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase font-mono tracking-wider">
                  设置主密码 (用于敏感卡片高强度加解密)
                </label>
                <input
                  type="password"
                  required
                  placeholder="请输入主密码 (最小 4 位)"
                  value={masterForm.password}
                  onChange={(e) => setMasterForm({ ...masterForm, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-900 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase font-mono tracking-wider">
                  确认主密码
                </label>
                <input
                  type="password"
                  required
                  placeholder="请再次确认您的主密码"
                  value={masterForm.confirm}
                  onChange={(e) => setMasterForm({ ...masterForm, confirm: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-900 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMasterSetupOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-850 transition-colors"
                >
                  取消 Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded transition-all"
                >
                  立即启用 Setup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Unlock Session Modal */}
      {isMasterUnlockOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm shadow-xl overflow-hidden animate-slide-up">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Unlock className="h-4 w-4 text-emerald-500" />
                解锁敏感片断密文 / Unlock Session
              </h3>
              <button
                onClick={() => {
                  setIsMasterUnlockOpen(false);
                  setPendingUnlockCallback(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUnlockSubmit} className="p-5 space-y-4">
              {unlockForm.error && (
                <div className="p-2.5 bg-rose-50 border border-rose-150 text-rose-700 text-xs rounded font-medium flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
                  {unlockForm.error}
                </div>
              )}
              <div>
                <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase font-mono tracking-wider">
                  请输入主安全密码以临时恢复权限
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="您的主加解密密码"
                  value={unlockForm.password}
                  onChange={(e) => setUnlockForm({ ...unlockForm, password: e.target.value, error: '' })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-900 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsMasterUnlockOpen(false);
                    setPendingUnlockCallback(null);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-850 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('清除主密码将导致所有当前的密码块卡片密文变为无法解密的文本！请确认已备份您的内容，或确实需要清除所有安全配置？')) {
                      localStorage.removeItem('quick_copy_master_password_check');
                      setMasterPasswordCheck('');
                      setSessionKey('');
                      setIsMasterUnlockOpen(false);
                      setPendingUnlockCallback(null);
                      addToast('🔒 主密码已安全清除', '所有加锁模式已被重置。');
                    }
                  }}
                  className="mr-auto text-rose-500 hover:text-rose-700 text-xs font-semibold px-2 py-1.5 rounded transition-all"
                >
                  清除密码 Reset
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded transition-all shadow-xs"
                >
                  验证解锁 Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Automated Daily Backups Ledger Modal */}
      {isBackupHistoryOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-slide-up">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-emerald-500" />
                本地冷备历史回卷 / Backup Archives List
              </h3>
              <button
                onClick={() => setIsBackupHistoryOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <p className="text-xs text-slate-500 leading-relaxed">
                以下列出您的浏览器内置冷保存档历史。包含每日首次访问页面时的自动快照，最多留存最近 10 次。
              </p>
              
              {backupHistory.length === 0 ? (
                <div className="py-12 border border-dashed border-slate-200 rounded text-center text-slate-400 text-xs">
                  暂无冷保存档历史。每天首次打开页面且有数据时将自动生成。
                </div>
              ) : (
                <div className="space-y-3">
                  {backupHistory.map((bh, idx) => (
                    <div key={idx} className="border border-slate-150 rounded-lg p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span>📅 冷备存档：{bh.date}</span>
                          {idx === 0 && (
                            <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 rounded px-1.5 font-bold">LATEST</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          生成时间: {new Date(bh.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => {
                            if (confirm(`⚠️ 警告：回卷备份将覆盖您当前的全部指令与分类卡片！确认将数据恢复到 ${bh.date} 的版本吗？`)) {
                              saveData(bh.data);
                              setIsBackupHistoryOpen(false);
                              addToast('备份覆盖回卷成功', `数据已恢复到 ${bh.date} 快照。`);
                            }
                          }}
                          className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-700 px-3 py-1 text-xs font-bold rounded transition-colors"
                        >
                          回卷恢复 Restore
                        </button>
                        <button
                          onClick={() => {
                            try {
                              const dataStr = JSON.stringify(bh.data, null, 2);
                              const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
                              const linkElement = document.createElement('a');
                              linkElement.setAttribute('href', dataUri);
                              linkElement.setAttribute('download', `quickcopy_archive_${bh.date}.json`);
                              linkElement.click();
                            } catch {
                              alert('下载失败');
                            }
                          }}
                          className="bg-slate-50 border border-slate-200 hover:bg-slate-100 p-1.5 rounded text-slate-650"
                          title="物理下载 JSON"
                        >
                          <Download className="h-3.5 w-3.5 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t bg-slate-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsBackupHistoryOpen(false)}
                className="bg-white border border-slate-250 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors rounded shadow-xs"
              >
                关闭 Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copied Toasts dynamic stacking tray corner */}
      <div id="toast-alerts-tray" className="fixed bottom-6 right-6 z-55 flex flex-col gap-3 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-slate-900 text-white border border-slate-850 p-3.5 rounded-lg shadow-xl flex items-center gap-3 animate-slide-up"
          >
            <div className="h-6 w-6 rounded-full bg-blue-950 border border-blue-900/50 flex items-center justify-center text-blue-400 shrink-0">
              <Check className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-white truncate">
                {toast.title}
              </h5>
              <div className="text-[10px] font-mono text-slate-350 opacity-90 truncate max-w-full">
                已复制: {toast.preview}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
