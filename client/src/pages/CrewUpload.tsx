import React, { useState, useCallback } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Upload, Camera, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';

interface UploadParams {
  projectId: string;
  token: string;
}

interface ValidationResult {
  valid: boolean;
  projectTitle?: string;
  crewName?: string;
  expiresAt?: string;
  message?: string;
}

interface UploadResult {
  success: boolean;
  filesUploaded: number;
  message: string;
}

export default function CrewUpload() {
  const { projectId, token } = useParams<UploadParams>();
  const [email, setEmail] = useState('');
  const [isEmailValidated, setIsEmailValidated] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const queryClient = useQueryClient();

  // Validate token and get project info
  const { data: validation, isLoading: validating, error: validationError } = useQuery({
    queryKey: ['/api/crew-upload/validate', projectId, token],
    queryFn: async () => {
      const response = await fetch(`/api/crew-upload/${projectId}/${token}/validate`);
      if (!response.ok) {
        throw new Error('Invalid or expired upload link');
      }
      return response.json() as Promise<ValidationResult>;
    },
    enabled: !!projectId && !!token,
  });

  // Validate email
  const emailValidation = useMutation({
    mutationFn: async (emailToValidate: string) => {
      const response = await fetch(`/api/crew-upload/${projectId}/${token}/validate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToValidate }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Email validation failed');
      }
      return response.json();
    },
    onSuccess: () => {
      setIsEmailValidated(true);
    },
  });

  // Upload files
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      formData.append('email', email);
      files.forEach((file, index) => {
        formData.append(`files`, file);
      });

      const response = await fetch(`/api/crew-upload/${projectId}/${token}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      return response.json() as Promise<UploadResult>;
    },
    onSuccess: (result) => {
      setUploadSuccess(true);
      setUploadedFiles([]);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Filter for JPEG/PNG files under 10MB
    const validFiles = acceptedFiles.filter(file => {
      const isValidType = file.type === 'image/jpeg' || file.type === 'image/png';
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });

    // Limit to 20 files total
    const newFiles = [...uploadedFiles, ...validFiles].slice(0, 20);
    setUploadedFiles(newFiles);
  }, [uploadedFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: !isEmailValidated || uploadSuccess
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      emailValidation.mutate(email.trim());
    }
  };

  const handleUpload = () => {
    if (uploadedFiles.length > 0) {
      uploadMutation.mutate(uploadedFiles);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(files => files.filter((_, i) => i !== index));
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Clock className="h-8 w-8 mx-auto text-blue-600 animate-spin mb-4" />
              <p className="text-gray-600">Проверка ссылки...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (validationError || !validation?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Ссылка недействительна</h2>
              <p className="text-gray-600">
                {validation?.message || 'Срок действия ссылки истёк или она неверна.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (uploadSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Спасибо!</h2>
              <p className="text-gray-600 mb-4">
                Фото успешно отправлены в систему SCAC.
              </p>
              <p className="text-sm text-gray-500">
                Проект: {validation.projectTitle}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Camera className="h-6 w-6 text-blue-600" />
              <span>Загрузка фото-отчёта</span>
            </CardTitle>
            <div className="text-sm text-gray-600">
              <p>Проект: <span className="font-medium">{validation.projectTitle}</span></p>
              <p>Бригада: <span className="font-medium">{validation.crewName}</span></p>
              {validation.expiresAt && (
                <p>Ссылка действует до: <span className="font-medium">
                  {new Date(validation.expiresAt).toLocaleString('ru-RU')}
                </span></p>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isEmailValidated ? (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Ваш корпоративный email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ivan.petrov@firma.de"
                    required
                    disabled={emailValidation.isPending}
                  />
                  {emailValidation.error && (
                    <Alert className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {emailValidation.error.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <Button 
                  type="submit" 
                  disabled={!email.trim() || emailValidation.isPending}
                  className="w-full"
                >
                  {emailValidation.isPending ? 'Проверка...' : 'Подтвердить email'}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Email подтверждён: {email}
                  </AlertDescription>
                </Alert>

                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  {isDragActive ? (
                    <p className="text-blue-600">Отпустите файлы здесь...</p>
                  ) : (
                    <div>
                      <p className="text-gray-600 mb-2">
                        Перетащите фото сюда или кликните для выбора
                      </p>
                      <p className="text-sm text-gray-500">
                        JPEG/PNG, максимум 10 МБ, до 20 файлов
                      </p>
                    </div>
                  )}
                </div>

                {uploadedFiles.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">
                      Выбрано файлов: {uploadedFiles.length}/20
                    </h3>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm truncate">{file.name}</span>
                          <button
                            onClick={() => removeFile(index)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {uploadedFiles.length > 0 && (
                  <Button 
                    onClick={handleUpload}
                    disabled={uploadMutation.isPending}
                    className="w-full"
                  >
                    {uploadMutation.isPending 
                      ? `Загрузка... (${uploadedFiles.length} файлов)` 
                      : `Загрузить ${uploadedFiles.length} файлов`
                    }
                  </Button>
                )}

                {uploadMutation.error && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {uploadMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}