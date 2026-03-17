import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner@2.0.3';
import { 
  Upload, 
  FileText, 
  Image, 
  X, 
  CheckCircle, 
  AlertCircle,
  User,
  Mail,
  Phone,
  MessageSquare
} from 'lucide-react';

interface CVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CVUploadModal({ isOpen, onClose }: CVUploadModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxFileSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif'
  ];

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image;
    return FileText;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File) => {
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload PDF, Word document, or image files only.');
      return false;
    }
    if (file.size > maxFileSize) {
      toast.error('File size too large. Please upload files smaller than 5MB.');
      return false;
    }
    return true;
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (validateFile(file)) {
      setUploadedFile(file);
      toast.success('File uploaded successfully!');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!uploadedFile) {
      toast.error('Please upload your CV before submitting.');
      return;
    }

    if (!formData.name || !formData.email) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsUploading(true);
    
    try {
      // Simulate API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('Your CV has been submitted successfully! We\'ll be in touch soon.');
      
      // Reset form
      setFormData({ name: '', email: '', phone: '', message: '' });
      setUploadedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    } catch (error) {
      toast.error('There was an error submitting your CV. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center mb-2">
            Submit Your CV
          </DialogTitle>
          <DialogDescription className="text-center text-lg">
            We'd love to hear from you! Upload your CV and tell us about yourself.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-8 mt-6">
          {/* Personal Information */}
          <div className="space-y-4 lg:space-y-6">
            <h3 className="text-lg lg:text-xl font-semibold text-gray-900">Contact Information</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700">
                  Full Name *
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your full name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700">
                  Email Address *
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-700">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+27 12 345 6789"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="space-y-4 lg:space-y-6">
            <h3 className="text-lg lg:text-xl font-semibold text-gray-900">Upload Your CV *</h3>
            
            {!uploadedFile ? (
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 lg:p-12 text-center transition-colors ${
                  dragActive 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
                }`}
                onDrop={handleDrop}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="mx-auto h-12 w-12 lg:h-16 lg:w-16 text-gray-400 mb-4 lg:mb-6" />
                <p className="text-lg lg:text-xl font-medium text-gray-900 mb-2 lg:mb-4">
                  Drop your CV here, or click to browse
                </p>
                <p className="text-sm lg:text-base text-gray-600 mb-4 lg:mb-6">
                  Supported formats: PDF, Word, Images (JPEG, PNG, GIF)
                </p>
                <p className="text-xs lg:text-sm text-gray-500">
                  Maximum file size: 5MB
                </p>
                <Button type="button" variant="outline" className="mt-4">
                  Choose File
                </Button>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4 lg:p-6 bg-green-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      {React.createElement(getFileIcon(uploadedFile), { 
                        className: "h-5 w-5 text-green-600" 
                      })}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                      <p className="text-sm text-gray-600">{formatFileSize(uploadedFile.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeFile}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 lg:p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">File Requirements:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>PDF documents preferred</li>
                    <li>Word documents (.doc, .docx) accepted</li>
                    <li>Image files (JPEG, PNG, GIF) accepted</li>
                    <li>Maximum file size: 5MB</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Message Section */}
          <div className="space-y-2">
            <Label htmlFor="message" className="text-gray-700">
              Tell us about yourself
            </Label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Textarea
                id="message"
                placeholder="Tell us about your experience, what role you're interested in, or why you'd like to work with Navigate Wealth..."
                value={formData.message}
                onChange={(e) => handleInputChange('message', e.target.value)}
                className="pl-10 min-h-[100px] lg:min-h-[120px]"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 pt-4 lg:pt-6">
            <Button
              type="submit"
              disabled={isUploading}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 lg:py-4 lg:text-lg"
            >
              {isUploading ? (
                <div className="contents">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Submitting...
                </div>
              ) : (
                'Submit Application'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 py-3 lg:py-4 lg:text-lg"
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}