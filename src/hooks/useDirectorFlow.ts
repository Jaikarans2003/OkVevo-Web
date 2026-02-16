
import { useState, useCallback } from 'react';

export type DirectorFlowState =
    | 'idle'
    | 'naming'
    | 'scripting'
    | 'duration'
    | 'aspect_ratio'
    | 'genre'
    | 'review'
    | 'generating'
    | 'complete';

export interface DirectorProject {
    name: string;
    script: string;
    duration: string;
    aspectRatio: string;
    genre: string;
    videoUrl?: string;
    audioUrl?: string;
}

export interface Message {
    id: string;
    role: 'assistant' | 'user';
    content: string;
    type?: 'text' | 'choice' | 'review' | 'result';
    timestamp: number;
}

export function useDirectorFlow() {
    const [currentState, setCurrentState] = useState<DirectorFlowState>('naming');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hi I'm VEVO your creative assistant. Let's create something cinematic. First, what should we name this project?",
            timestamp: Date.now()
        }
    ]);
    const [project, setProject] = useState<DirectorProject>({
        name: '',
        script: '',
        duration: '',
        aspectRatio: '',
        genre: ''
    });

    const addMessage = useCallback((content: string, role: 'assistant' | 'user', type: Message['type'] = 'text') => {
        const newMessage: Message = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content,
            role,
            type,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, newMessage]);
    }, []);

    const handleNext = useCallback(async (input: string) => {
        // Add user message
        addMessage(input, 'user');

        switch (currentState) {
            case 'naming':
                setProject(prev => ({ ...prev, name: input }));
                addMessage(`Great, "${input}" it is! Now, describe the scene you want to create or paste your script here.`, 'assistant');
                setCurrentState('scripting');
                break;

            case 'scripting':
                setProject(prev => ({ ...prev, script: input }));
                addMessage("Perfect. How long should this video be? Select a duration:", 'assistant', 'choice');
                setCurrentState('duration');
                break;

            case 'duration':
                setProject(prev => ({ ...prev, duration: input }));
                addMessage("Understood. What's the target aspect ratio?", 'assistant', 'choice');
                setCurrentState('aspect_ratio');
                break;

            case 'aspect_ratio':
                setProject(prev => ({ ...prev, aspectRatio: input }));
                addMessage("And finally, what's the cinematic style or genre for this project?", 'assistant', 'choice');
                setCurrentState('genre');
                break;

            case 'genre':
                const finalProject = { ...project, genre: input };
                setProject(finalProject);
                addMessage("Excellent choices. Here's a summary of your project:", 'assistant', 'review');
                setCurrentState('review');
                break;

            case 'review':
                if (input.toLowerCase().includes('yes') || input.toLowerCase().includes('proceed')) {
                    addMessage("Initializing cinematic engine... Generating your scene.", 'assistant');
                    setCurrentState('generating');

                    // Simulate API Call with Mock Media
                    setTimeout(() => {
                        setProject(prev => ({
                            ...prev,
                            videoUrl: "https://cdn.pixabay.com/video/2022/02/09/107240-678130070_large.mp4",
                            audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                        }));
                        addMessage("Your cinematic scene is ready! Take a look.", 'assistant', 'result');
                        setCurrentState('complete');
                    }, 4000);
                } else {
                    addMessage("What would you like to change?", 'assistant');
                    // Logic to jump back could go here, for now just reset or ask again
                }
                break;

            default:
                break;
        }
    }, [currentState, project, addMessage]);

    const resetFlow = useCallback(() => {
        setMessages([
            {
                id: '1',
                role: 'assistant',
                content: "Welcome to Director Mode. Let's create something cinematic. First, what should we name this project?",
                timestamp: Date.now()
            }
        ]);
        setCurrentState('naming');
        setProject({
            name: '',
            script: '',
            duration: '',
            aspectRatio: '',
            genre: ''
        });
    }, []);

    return {
        messages,
        currentState,
        project,
        handleNext,
        setCurrentState,
        resetFlow
    };
}
