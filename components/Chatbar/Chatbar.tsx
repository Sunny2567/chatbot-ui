import { useCallback, useContext, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { saveConversation, saveConversations } from '@/utils/app/conversation';
import { saveFolders } from '@/utils/app/folders';
import { exportData, importData } from '@/utils/app/importExport';

import { Conversation } from '@/types/chat';
import { LatestExportFormat, SupportedExportFormats } from '@/types/export';
// import { OpenAIModels } from '@/types/openai';
import { OpenAIModels, fallbackModelID } from '@/types/openai';
import { PluginKey } from '@/types/plugin';

import HomeContext from '@/pages/api/home/home.context';

import { ChatFolders } from './components/ChatFolders';
import { ChatbarSettings } from './components/ChatbarSettings';
import { Conversations } from './components/Conversations';

import Sidebar from '../Sidebar';
import ChatbarContext from './Chatbar.context';
import { ChatbarInitialState, initialState } from './Chatbar.state';

import { v4 as uuidv4 } from 'uuid';

import { FolderInterface } from '@/types/folder';

export const Chatbar = () => {
  const { t } = useTranslation('sidebar');

  const chatBarContextValue = useCreateReducer<ChatbarInitialState>({
    initialState,
  });

  const {
    state: { conversations, showChatbar, defaultModelId, folders, pluginKeys },
    dispatch: homeDispatch,
    handleCreateFolder,
    handleNewConversation,
    handleUpdateConversation,
  } = useContext(HomeContext);

  const {
    state: { searchTerm, filteredConversations },
    dispatch: chatDispatch,
  } = chatBarContextValue;

  const handleApiKeyChange = useCallback(
    (apiKey: string) => {
      // 将'apiKey'字段的值更新为apiKey。
      homeDispatch({ field: 'apiKey', value: apiKey });

      // 将apiKey保存到本地存储中。
      localStorage.setItem('apiKey', apiKey);
    },
    [homeDispatch],
  );

  const handlePluginKeyChange = (pluginKey: PluginKey) => {
    if (pluginKeys.some((key) => key.pluginId === pluginKey.pluginId)) {
      const updatedPluginKeys = pluginKeys.map((key) => {
        if (key.pluginId === pluginKey.pluginId) {
          return pluginKey;
        }

        return key;
      });

      homeDispatch({ field: 'pluginKeys', value: updatedPluginKeys });

      localStorage.setItem('pluginKeys', JSON.stringify(updatedPluginKeys));
    } else {
      homeDispatch({ field: 'pluginKeys', value: [...pluginKeys, pluginKey] });

      localStorage.setItem(
        'pluginKeys',
        JSON.stringify([...pluginKeys, pluginKey]),
      );
    }
  };

  const handleClearPluginKey = (pluginKey: PluginKey) => {
    const updatedPluginKeys = pluginKeys.filter(
      (key) => key.pluginId !== pluginKey.pluginId,
    );

    if (updatedPluginKeys.length === 0) {
      homeDispatch({ field: 'pluginKeys', value: [] });
      localStorage.removeItem('pluginKeys');
      return;
    }

    homeDispatch({ field: 'pluginKeys', value: updatedPluginKeys });

    localStorage.setItem('pluginKeys', JSON.stringify(updatedPluginKeys));
  };

  const handleExportData = () => {
    exportData();
  };

  const handleImportConversations = (data: SupportedExportFormats) => {
    const { history, folders, prompts }: LatestExportFormat = importData(data);
    homeDispatch({ field: 'conversations', value: history });
    homeDispatch({
      field: 'selectedConversation',
      value: history[history.length - 1],
    });
    homeDispatch({ field: 'folders', value: folders });
    homeDispatch({ field: 'prompts', value: prompts });

    window.location.reload();
  };

  const handleClearConversations = () => {
    defaultModelId &&
      homeDispatch({
        field: 'selectedConversation',
        value: {
          id: uuidv4(),
          name: t('New Conversation'),
          messages: [],
          model: OpenAIModels[defaultModelId],
          prompt: DEFAULT_SYSTEM_PROMPT,
          temperature: DEFAULT_TEMPERATURE,
          folderId: null,
        },
      });

    homeDispatch({ field: 'conversations', value: [] });

    localStorage.removeItem('conversationHistory');
    localStorage.removeItem('selectedConversation');

    const updatedFolders = folders.filter((f) => f.type !== 'chat');

    homeDispatch({ field: 'folders', value: updatedFolders });
    saveFolders(updatedFolders);
  };

  const handleDeleteConversation = (conversation: Conversation) => {
    const updatedConversations = conversations.filter(
      (c) => c.id !== conversation.id,
    );

    homeDispatch({ field: 'conversations', value: updatedConversations });
    chatDispatch({ field: 'searchTerm', value: '' });
    saveConversations(updatedConversations);

    if (updatedConversations.length > 0) {
      homeDispatch({
        field: 'selectedConversation',
        value: updatedConversations[updatedConversations.length - 1],
      });

      saveConversation(updatedConversations[updatedConversations.length - 1]);
    } else {
      defaultModelId &&
        homeDispatch({
          field: 'selectedConversation',
          value: {
            id: uuidv4(),
            name: t('New Conversation'),
            messages: [],
            model: OpenAIModels[defaultModelId],
            prompt: DEFAULT_SYSTEM_PROMPT,
            temperature: DEFAULT_TEMPERATURE,
            folderId: null,
          },
        });

      localStorage.removeItem('selectedConversation');
    }
  };

  const handleToggleChatbar = () => {
    homeDispatch({ field: 'showChatbar', value: !showChatbar });
    localStorage.setItem('showChatbar', JSON.stringify(!showChatbar));
  };

  const handleDrop = (e: any) => {
    if (e.dataTransfer) {
      const conversation = JSON.parse(e.dataTransfer.getData('conversation'));
      handleUpdateConversation(conversation, { key: 'folderId', value: 0 });
      chatDispatch({ field: 'searchTerm', value: '' });
      e.target.style.background = 'none';
    }
  };

  // 在搜索条件发生变化时，根据条件对对话进行过滤，
  // 并将过滤后的结果更新到 filteredConversations 字段中。
  // 实现动态搜索和过滤功能。
  useEffect(() => {
    if (searchTerm) {
      chatDispatch({
        field: 'filteredConversations',
        value: conversations.filter((conversation) => {
          const searchable =
            conversation.name.toLocaleLowerCase() +
            ' ' +
            conversation.messages.map((message) => message.content).join(' ');
          return searchable.toLowerCase().includes(searchTerm.toLowerCase());
        }),
      });
    } else {
      chatDispatch({
        field: 'filteredConversations',
        value: conversations,
      });
    }
  }, [searchTerm, conversations]);
  
  return (
    <ChatbarContext.Provider
      value={{
        ...chatBarContextValue,
        handleDeleteConversation,
        handleClearConversations,
        handleImportConversations,
        handleExportData,
        handlePluginKeyChange,
        handleClearPluginKey,
        handleApiKeyChange,
      }}
    >
      {/* 渲染一个侧边栏，用于展示会话列表、文件夹列表以及其他相关功能。
      侧边栏的显示与隐藏、搜索词的更新等操作都通过属性和回调函数进行处理。 */}
      <Sidebar<Conversation>
        side={'left'}
        isOpen={showChatbar}
        // 指定一个标题，用于在侧边栏中显示一个按钮来创建新的聊天。
        addItemButtonTitle={t('New chat')}
        // 渲染会话列表组件，传入经过筛选后的会话数组作为属性。
        itemComponent={<Conversations conversations={filteredConversations} />}
        // 渲染文件夹列表组件，并传入搜索词 searchTerm 作为属性。
        folderComponent={<ChatFolders searchTerm={searchTerm} />}
        // 会话列表的数据源，传入经过筛选后的会话数组。
        items={filteredConversations}
        // 当前的搜索词，用于在侧边栏中执行搜索操作。
        searchTerm={searchTerm}
        // 处理搜索词更新的函数，当搜索词发生变化时，通过 chatDispatch 更新状态。
        handleSearchTerm={(searchTerm: string) =>
          chatDispatch({ field: 'searchTerm', value: searchTerm })
        }
        // 指定一个处理打开/关闭侧边栏的函数。
        toggleOpen={handleToggleChatbar}
        // 处理创建新会话的函数。
        handleCreateItem={handleNewConversation}
        // 处理创建文件夹的函数。
        handleCreateFolder={() => handleCreateFolder(t('New folder'), 'chat')}
        // 指定一个处理拖放操作的函数。
        handleDrop={handleDrop}
        // 渲染聊天栏设置组件。
        footerComponent={<ChatbarSettings />}
      />
    </ChatbarContext.Provider>
  );
};
