from django.urls import path
from . import views

urlpatterns = [
    path('recruiter-wise/', views.RecruiterWiseReportView.as_view(), name='recruiter-wise'),
    path('contacted-vs-uncontacted/', views.ContactedVsUncontactedReportView.as_view(), name='contacted-vs-uncontacted'),
    path('fresh-to-pipeline/', views.FreshToPipelineReportView.as_view(), name='fresh-to-pipeline'),
    path('negative-breakdown/', views.NegativeBreakdownReportView.as_view(), name='negative-breakdown'),
    path('follow-up-pending/', views.FollowUpPendingReportView.as_view(), name='follow-up-pending'),
    path('pipeline-stages/', views.PipelineStagesReportView.as_view(), name='pipeline-stages'),
    path('upload-batch-summary/', views.UploadBatchSummaryReportView.as_view(), name='upload-batch-summary'),
    path('duplicates/', views.DuplicateReportView.as_view(), name='duplicate-report'),
    path('daily-trends/', views.DailyTrendsReportView.as_view(), name='daily-trends'),
    path('recruiter-productivity/', views.RecruiterProductivityReportView.as_view(), name='recruiter-productivity'),
    path('export-csv/', views.ExportCandidatesCSVView.as_view(), name='export-csv'),
]
