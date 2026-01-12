import { useState, useEffect } from 'react';
import { generateGreeting, analyzeScenes } from '../services/AIService';
import type { ChatMessage, Scene } from '../services/AIService';

export type ChatFlowState = 'greeting' | 'awaiting_story' | 'awaiting_enhancement_confirmation' | 'analyzing' | 'scenes_ready' | 'awaiting_proceed_confirmation';

export function useChatFlow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentState, setCurrentState] = useState<ChatFlowState>('greeting');
  const [currentUserStory, setCurrentUserStory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingVideos, setGeneratingVideos] = useState(false);

  // Generate greeting on first load
  useEffect(() => {
    const initializeGreeting = async () => {
      if (messages.length === 0) {
        setLoading(true);
        try {
          const greeting = await generateGreeting();
          setMessages([{
            role: 'assistant',
            content: greeting,
            type: 'greeting'
          }]);
          setCurrentState('awaiting_story');
        } catch (err) {
          console.error(err);
          setError('Failed to generate greeting');
          // Fallback greeting
          setMessages([{
            role: 'assistant',
            content: "Welcome to Brick2Brick! I'm here to help bring your visual stories to life. Share your ideas and let's create something amazing together!",
            type: 'greeting'
          }]);
          setCurrentState('awaiting_story');
        } finally {
          setLoading(false);
        }
      }
    };

    initializeGreeting();
  }, [messages.length]);

  const addUserMessage = (content: string) => {
    const userMessage: ChatMessage = {
      role: 'user',
      content: content
    };
    setMessages(prev => [...prev, userMessage]);
    return userMessage;
  };

  const addAssistantMessage = (content: string, type?: ChatMessage['type']) => {
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: content,
      type: type
    };
    setMessages(prev => [...prev, assistantMessage]);
    return assistantMessage;
  };

  const processUserStory = async (userStory: string) => {
    if (!userStory.toLowerCase().startsWith('@script')) {
      addAssistantMessage("Please use the '@Script' format to submit your story.");
      return;
    }

    setLoading(true);
    setError(null);
    addUserMessage(userStory);

    const storyContent = userStory.substring('@script'.length).trim();
    setCurrentUserStory(storyContent);

    addAssistantMessage("Shall I enhance your story with cinematic elements....");
    setCurrentState('awaiting_enhancement_confirmation');
    setLoading(false);
  };

  const handleEnhancementConfirmation = async (userResponse: string): Promise<Scene[] | undefined> => {
    addUserMessage(userResponse);
    setLoading(true);
    setError(null);

    if (userResponse.toLowerCase().trim().includes('yes')) {
      if (currentUserStory) {
        try {
          setCurrentState('analyzing');
          addAssistantMessage("Creating cinematic scenes from your story...", 'scenes');

          const scenes = await analyzeScenes(currentUserStory);

          // Add Scene Reviewer as a message
          addAssistantMessage("Scene Review", 'scene_review');

          setCurrentState('awaiting_proceed_confirmation');
          setLoading(false);
          return scenes;

        } catch (err) {
          setError('Failed to analyze scenes');
          addAssistantMessage("I apologize, but I couldn't create the scenes. Please try again with a different story.");
          setCurrentState('awaiting_story');
          setLoading(false);
          throw err;
        }
      }
    } else {
      addAssistantMessage("Scene Enhancer is Required.");
      setCurrentState('awaiting_story');
      setLoading(false);
    }
    return undefined;
  };

  const handleProceedConfirmation = (userResponse: string) => {
    addUserMessage(userResponse);
    // Remove punctuation and check if response contains 'proceed'
    const cleanedResponse = userResponse.toLowerCase().trim().replace(/[.,!?;:]/g, '');
    if (cleanedResponse === 'proceed' || cleanedResponse === 'yes' || cleanedResponse === 'continue') {
      setGeneratingVideos(true);
      setCurrentState('scenes_ready');
    } else {
      // User provided feedback instead of proceeding
      addAssistantMessage("I'll regenerate the scenes based on your feedback.");
      setCurrentState('awaiting_enhancement_confirmation');
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setCurrentState('greeting');
    setError(null);
    setLoading(false);
    setCurrentUserStory(null);
    setGeneratingVideos(false);
  };

  return {
    messages,
    currentState,
    loading,
    error,
    generatingVideos,
    processUserStory,
    handleEnhancementConfirmation,
    handleProceedConfirmation,
    resetConversation
  };
}