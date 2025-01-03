import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Classifications from '@/components/dashboard/Classifications';
import Navbar from '@/components/dashboard/Navbar';
import Notifications from '@/components/dashboard/Notifications';
import QuickActions from '@/components/dashboard/QuickActions';
import RecentUploads from '@/components/dashboard/RecentUploads';
import DocumentProcessingLoader from '@/components/DocumentProcessingLoader';
import StatsGrid from '@/components/dashboard/StatsGrid';
import { NOTIFICATIONS, RECENT_UPLOADS, PROCESSING_RESULTS } from '@/constants/dashboardData';
import AnalyticsPage from '@/pages/AnalyticsPage';

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);  // Add this new state
  const [processingResults, setProcessingResults] = useState(PROCESSING_RESULTS);
  const [recentUploads, setRecentUploads] = useState(RECENT_UPLOADS);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [error, setError] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState(new Map());

  const processDocumentWithModel = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${SERVER_URL}/api/uploadsingle/`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.status === 'failed') {
        throw new Error('Document processing failed');
      }
      console.log('Document processed successfully');
      console.log(data);
      return data;
    } catch (error) {
      setError(error.message);
      return null;
    }
  };

  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';

    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // File validations
      if (file.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10MB limit");
        return;
      }
      if (!file.type.includes('pdf')) {
        setError("Only PDF files are allowed");
        return;
      }

      setError(null);
      setIsProcessing(true);
      setShowResults(false);

      try {
        const response = await processDocumentWithModel(file);
        if (!response) {
          throw new Error("Processing failed");
        }

        const results = {
          modelResponses: [],
          finalClassification: '',
          overallConfidence: 0
        };

        // Process predictions sequentially with delays
        for (let i = 0; i < response.predictions.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between each
          const prediction = response.predictions[i];
          
          results.modelResponses.push({
            model: prediction.model,
            category: prediction.predicted_category,
            confidence: Math.floor(Math.random() * 15) + 85 // Simulated confidence
          });

          // Update processing results for each prediction
          setProcessingResults({...results});
        }

        // Calculate final classification (most common category)
        const categories = results.modelResponses.map(r => r.category);
        const mostCommon = categories.sort((a, b) =>
          categories.filter(v => v === a).length - categories.filter(v => v === b).length
        ).pop();

        results.finalClassification = mostCommon;
        results.overallConfidence = Math.floor(
          results.modelResponses.reduce((acc, curr) => acc + curr.confidence, 0) / results.modelResponses.length
        );

        // Update uploads list
        const newUpload = {
          id: Date.now(),
          name: response.filename,
          status: `Classified as: ${results.finalClassification}`,
          time: "Just now",
          confidence: results.overallConfidence,
          skills: ["JavaScript", "React", "Node.js"]
        };
        
        const updatedMap = new Map(uploadedFiles).set(newUpload.id, file);
        setUploadedFiles(updatedMap);
        window.uploadedFiles = updatedMap;
        
        setRecentUploads(prev => [newUpload, ...prev]);
        setProcessingResults(results);
        setShowResults(true);

      } catch (error) {
        setError(error.message);
        setProcessingResults(null);
      } finally {
        setTimeout(() => {
          setIsProcessing(false);
          setTimeout(() => {
            setShowResults(false);
          }, 4000);
          if (error) {
            setTimeout(() => setError(null), 5000);
          }
        }, 1000);
      }
    };
    input.click();
  };

  const handleUploadSelect = (upload) => {
    setSelectedUpload(selectedUpload?.id === upload.id ? null : upload);
  };

  const renderAnalytics = () => (
    <div>
      <AnalyticsPage />
    </div>
  );

  const renderSettings = () => (
    <Card>
      <CardHeader>
        <CardTitle>System Settings</CardTitle>
        <CardDescription>Configure your preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium">Notification Preferences</h3>
            <div className="space-y-2">
              {['Email Notifications', 'Push Notifications', 'Weekly Reports'].map((setting) => (
                <div key={setting} className="flex items-center justify-between p-2">
                  <span>{setting}</span>
                  <button className="w-12 h-6 bg-blue-600 rounded-full relative">
                    <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'classifications':
        return <Classifications />;
      case 'analytics':
        return renderAnalytics();
      case 'settings':
        return renderSettings();
      default:
        return (
          <>
            <StatsGrid />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <RecentUploads
                  uploads={recentUploads}
                  selectedUpload={selectedUpload}
                  onUploadSelect={handleUploadSelect}
                  uploadedFiles={uploadedFiles}
                />
              </div>
              <div>
                <Notifications notifications={NOTIFICATIONS} />
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <DocumentProcessingLoader
        isLoading={isProcessing || showResults}
        modelResults={processingResults}
        error={error}
      />
      <Navbar setActiveTab={setActiveTab} />

      <div className="p-6 max-w-7xl mx-auto">
        <QuickActions setActiveTab={setActiveTab} handleUploadClick={handleUploadClick} />
        {renderContent()}
      </div>
    </div>
  );
};

export default Dashboard;