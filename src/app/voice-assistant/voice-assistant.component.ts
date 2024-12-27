import { Component } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import RecordRTC from 'recordrtc';

@Component({
  selector: 'app-voice-assistant',
  templateUrl: './voice-assistant.component.html',
  styleUrls: ['./voice-assistant.component.scss']
})
export class VoiceAssistantComponent {
  private recorder!: RecordRTC;
  isRecording = false;
  audioResponse: any;
  userSpeech = '';
  status = 'start';
  private silenceTimer: any;
  private recognition: any;
  private currentAudio: HTMLAudioElement | null = null;

  constructor(private http: HttpClient) {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new (window as any).webkitSpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;

      this.recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        this.userSpeech = transcript;
        this.resetSilenceTimer();
      };

      this.recognition.onend = () => {
        if (this.isRecording) {
          this.recognition.start();
        }
      };
    }
  }

  handleMicClick() {
    if (this.status === 'start' || this.status === 'responding') {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      this.startCall();
    }
  }

  startCall() {
    this.isRecording = true;
    this.status = 'listening';
    this.userSpeech = '';

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        this.recorder = new RecordRTC(stream, {
          type: 'audio',
          mimeType: 'audio/webm',
          recorderType: RecordRTC.StereoAudioRecorder
        });
        this.recorder.startRecording();
        this.recognition.start();
        this.resetSilenceTimer();
      });
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (this.isRecording) {
        this.processRecording();
      }
    }, 2000); // 2 seconds of silence
  }

  processRecording() {
    this.endConversation()
    this.isRecording = false;
    this.status = 'thinking';
    this.recognition.stop();

    this.recorder.stopRecording(() => {
      const blob = this.recorder.getBlob();
      const formData = new FormData();
      formData.append('data', blob);

      const headers = new HttpHeaders({
        'Accept': 'application/json, text/plain, */*'
      });
      this.recorder.destroy()
      this.recorder = null as any
      this.http.post('https://fonada.app.n8n.cloud/webhook/dbf05039-6da2-4ffe-b3dc-1cfa03d121ec',
        formData,
        { headers, responseType: 'blob' }
      ).subscribe({
        next: (response: Blob) => {
          if (response.size > 0) {
            this.status = 'responding';
            this.playResponseAudio(response);


          } else {
            console.error('Received empty response');
            this.prepareForNextInteraction();
          }
        },
        error: (error) => {
          console.error('Error sending audio:', error);
          this.prepareForNextInteraction();
        }
      });
    });
  }

  private playResponseAudio(audioBlob: Blob) {
    try {
      const audioUrl = URL.createObjectURL(audioBlob);
      this.currentAudio = new Audio(audioUrl);

      this.currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        console.log('line 126');


        setTimeout(() => {
          this.prepareForNextInteraction();
        }, 0);

      };

      this.currentAudio.onerror = (error) => {
        console.error('Audio playback error:', error);
        this.prepareForNextInteraction();
      };

      this.currentAudio.play().catch(error => {
        console.error('Audio play failed:', error);
        this.prepareForNextInteraction();
      });
    } catch (error) {
      console.error('Error creating audio URL:', error);
      this.prepareForNextInteraction();
    }
  }

  private prepareForNextInteraction() {
    console.log('line 147');
    this.startCall();
  }

  endConversation() {
    console.warn('hello', this.isRecording);
    if (this.isRecording) {
      this.recorder.stopRecording();
      this.recognition.stop();
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    this.isRecording = false;
    this.status = 'start';
    this.userSpeech = '';
  }

  ngOnDestroy() {
    this.endConversation();
  }
} 